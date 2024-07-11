import os
import re
import ast
import json
from findAPIDefs import find_api_definitions
# Regular expressions to match URLs and config variable usage
url_pattern = re.compile(r'(https?://[^\s]+)')
config_var_pattern = re.compile(r'(["\'])(?P<var_name>[A-Z_]+)["\']\s*:\s*["\'](?P<url>https?://[^\s]+)["\']')
env_var_pattern = re.compile(r'os\.environ\["([A-Z_]+)"\]')

class VariableUsageVisitor(ast.NodeVisitor):
    def __init__(self, target_var):
        self.target_var = target_var
        self.usages = []

    def visit_Name(self, node):
        print(node.lineno)
        if isinstance( node, ast.Name ):
            print('VISITING NODE->', node, isinstance(node.ctx, ast.Load), node.id)

        if isinstance(node.ctx, ast.Load) and node.id == self.target_var:
            self.usages.append(node)
        self.generic_visit(node)

class MethodVisitor(ast.NodeVisitor):
    def __init__(self, target_var):
        self.target_var = target_var
        self.methods = []

    def visit_FunctionDef(self, node):
        # Visit the method node to find usages of the target variable
        var_usage_visitor = VariableUsageVisitor(self.target_var)
        var_usage_visitor.visit(node)
        
        if var_usage_visitor.usages:
            self.methods.append({
                'method_name': node.name,
                'start_line': node.lineno,
                'end_line': node.body[-1].lineno if node.body else node.lineno,
                'usages': [{
                    'line': usage.lineno,
                    'col_offset': usage.col_offset
                } for usage in var_usage_visitor.usages]
            })
        self.generic_visit(node)

class NodeVisitorWithParent(ast.NodeVisitor):

    def __init__(self):
        self.parent = None
        super().__init__()

    def generic_visit(self, node):
        if hasattr(node, 'body') and isinstance(node.body, list):
            for child in node.body:
                child.parent = node
        super().generic_visit(node)

class URLExtractor(ast.NodeVisitor):
    def __init__(self):
        self.urls = []

    def visit_FunctionDef(self, node):
        self.current_function = node
        self.generic_visit(node)

    def visit_Assign(self, node):
        if isinstance(node.targets[0], ast.Name):
            var_name = node.targets[0].id
            if isinstance(node.value, ast.BinOp) and isinstance(node.value.op, ast.Add):
                # Check if URL is constructed with addition operation
                url_parts = self.extract_constant_parts(node.value)
                if url_parts:
                    self.urls.append({
                        "variable": var_name,
                        "parts": url_parts,
                        "function": self.current_function.name
                    })
        self.generic_visit(node)

    def extract_constant_parts(self, node):
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
            left_parts = self.extract_constant_parts(node.left)
            right_parts = self.extract_constant_parts(node.right)
            if left_parts is not None and right_parts is not None:
                return left_parts + right_parts
        elif isinstance(node, ast.Constant) and isinstance(node.value, str):
            if node.value.count("/") > 2:
                return [node.value]
        return []

def extract_urls_from_code( tree ):
    extractor = URLExtractor()
    extractor.visit(tree)
    return extractor.urls

def get_all_files(directory):
    """Get all files in the given directory and subdirectories."""
    files_list = []
    for root, _, files in os.walk(directory):
        for file in files:
            files_list.append(os.path.join(root, file))
    return files_list

def find_urls_in_file(file_path, local_routes):
    """Find all URLs and config variable definitions in the given file."""
    urls = []
    if '.py' not in file_path[-3:]: return urls

    with open(file_path, 'r', encoding='utf-8') as file:
        print('OPENING ->', file_path)
        content = file.read()
        urls.extend(url_pattern.findall(content))
        urls.extend(config_var_pattern.findall(content))
        urls.extend(env_var_pattern.findall(content))

        ## search for locally defined "routes"
        tree = ast.parse( content )

        ## in some cases, the url defined in a method is a combination of a base URL and the final path like so
        ### url = backend_platform_url + "/api/v1/globalMapping/ocr?sortBy=docType&orderBy=DESC"
        #### in this case, since we are looking for API definition across code bases, its the ENDPOINT that matter
        ##### hence i would benefit by identifying "/api/v1/globalMapping/ocr" and search for it in the codebase
        indirect_urls_ = extract_urls_from_code( tree )
        print('INDIRECT URLS=', indirect_urls_)
        
        id_urls_ = []
        if len( indirect_urls_ ) > 0:
            id_urls_ = [ x['parts'][0] for x in indirect_urls_ ]

        for route_ in local_routes:
            for node in ast.walk( tree ):
              if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and contains_var_as_BinOP( route_, node.value ) and \
                            route_ not in urls:
                        urls.append( route_ )

    return urls + id_urls_

def extract_urls_from_rhs(node, urls, var_nm):
    if isinstance(node, ast.Str):
        if ( url_pattern.search(node.s) and 'http' in node.s ) or var_nm in node.s:
            urls.append(node.s)
    elif isinstance(node, ast.List) or isinstance(node, ast.Tuple):
        for elem in node.elts:
            extract_urls_from_rhs(elem, urls, var_nm)
    elif isinstance(node, ast.Dict):
        for key, value in zip(node.keys, node.values):
            extract_urls_from_rhs(key, urls, var_nm)
            extract_urls_from_rhs(value, urls, var_nm)
    elif isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        extract_urls_from_rhs(node.left, urls, var_nm)
        extract_urls_from_rhs(node.right, urls, var_nm)
    elif isinstance(node, ast.Call):
        for arg in node.args:
            extract_urls_from_rhs(arg, urls, var_nm)
        for kw in node.keywords:
            extract_urls_from_rhs(kw.value, urls, var_nm)
    elif isinstance(node, ast.Name) and ( 'http' in node.id or var_nm in node.id ):
        urls.append(node.id)

def contains_var_as_BinOP( varNm, node ):

    if isinstance(node, ast.Str) and varNm in node.s:
        return True
    elif isinstance(node, ast.BinOp):
        return contains_var_as_BinOP(varNm, node.left) or contains_var_as_BinOP(varNm, node.right)
    elif isinstance(node, ast.Call):
        return any(contains_var_as_BinOP(varNm, arg) for arg in node.args)
    return False

def get_name_or_constant(node, store_):
        if isinstance(node, ast.Name):
            store_.append( node.id )
            return {"type": "variable", "value": node.id}
        elif isinstance(node, ast.Constant):
            store_.append( node.value )
            return {"type": "constant", "value": node.value}
        elif isinstance(node, ast.BinOp):
            return {"type": "binop", "value": get_lhs_rhs( node.right, node.left, store_ )}
        else:
            return {"type": "unknown", "value": ast.dump(node)}

def get_lhs_rhs( node_rt, node_lt, store_ ):
    left = get_name_or_constant( node_lt, store_ )
    rt = get_name_or_constant( node_rt, store_ )

def find_usages(file_path, var_name):
    """Find all usages of the given variable in the given file."""
    print('Finding USAGE', file_path, file_path[-3:])
    if '.py' not in file_path[-3:]: return []
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()
    tree = ast.parse(content)
    var_name = var_name.replace('"','').replace("'",'').replace('[','').replace(']','').\
                                         replace(',','').replace('{','').replace('}','')

    usages = []
    print('CHECKING FOR ->', var_name)

    visitor = NodeVisitorWithParent()
    visitor.visit(tree)

    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                line_no = node.lineno
                store_ = []
                if isinstance(node.value, ast.BinOp):
                    get_lhs_rhs( node.value.right, node.value.left, store_ )
                    #print('BINOP-> ::RHS::LHS::', get_lhs_rhs( node.value.right, node.value.left, store_ ), store_)
                    if var_name in store_:
                        method_node = node
                        while not isinstance(method_node, ast.FunctionDef) and hasattr(method_node, 'parent'):
                            method_node = method_node.parent
                        if isinstance(method_node, ast.FunctionDef):
                            usages.append((line_no, method_node.name))
                            print('ADDED FOR BINOP', var_name, method_node.name)
                        else:
                            usages.append((line_no, None))

                if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str) and\
                        var_name in node.value.value:
                    method_node = node
                    while not isinstance(method_node, ast.FunctionDef) and hasattr(method_node, 'parent'):
                        method_node = method_node.parent
                    if isinstance(method_node, ast.FunctionDef):
                        usages.append((line_no, method_node.name))
                    else:
                        usages.append((line_no, None))

                else:
                    rhs_urls = []
                    extract_urls_from_rhs( node.value, rhs_urls, var_name )
                    #print('RHS URLS->', node.value, rhs_urls)
                    for rhs_url in rhs_urls:
                        if var_name in rhs_url:
                            usages.append((line_no, None))
                            #print('APPENDING USAGE->', line_no, None, target.id, rhs_urls)
                            method_visitor = MethodVisitor(target.id)
                            method_visitor.visit(tree)
                            #print( 'URL-USAGES->', method_visitor.methods )

        elif isinstance(node, ast.Call):
            for arg in node.args:
                if isinstance(arg, ast.Name) and arg.id == var_name:
                    #print('VAR IS RHS!', var_name, arg.id)
                    line_no = node.lineno
                    method_node = node
                    while not isinstance(method_node, ast.FunctionDef) and hasattr(method_node, 'parent'):
                        method_node = method_node.parent
                    if isinstance(method_node, ast.FunctionDef):
                        usages.append((line_no, method_node.name))
                    else:
                        usages.append((line_no, None))
    return usages

def extract_method_code_snippet(file_path, method_name):
    """Extract the code snippet for the given method in the given file."""
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()
    tree = ast.parse(content)
    for node in ast.walk(tree):
        print('Extraction CODE_SNIP->', method_name)
        if isinstance(node, ast.FunctionDef) and node.name == method_name:
            return content[node.lineno - 1: node.end_lineno]
    return None

def analyze_codebase(directory):
    """Analyze the codebase to find all URLs and their usages."""
    result = {}
    files_list = get_all_files(directory)
    ## find all APIs defined locally
    api_defs_ = find_api_definitions( files_list )
    local_routes_ = list( set( [ apiDef['route_path'] for apiDef in api_defs_ ] ) )

    ## now track the urls defined all over the place including usage of locally defined APIs
    for file_path in files_list:
        urls = find_urls_in_file(file_path, local_routes_)
        print('DHUFF->', urls)
        for url in urls:
            if url in result:
                result[url].append({'file_name': file_path})
            else:
                result[url] = [{'file_name': file_path}]

    for apiDef in api_defs_:
        print('ADDING LOCALLY DEFINED->', apiDef['route_path'], apiDef[ 'file_path' ])
        if apiDef['route_path'] in result:
            result[ apiDef['route_path'] ].append({'api_definition': apiDef[ 'file_path' ], \
                                                   'file_name': apiDef[ 'file_path' ] })
        else:
            result[ apiDef['route_path'] ] = [{'api_definition': apiDef[ 'file_path' ], \
                                               'file_name': apiDef[ 'file_path' ]}]

    for url, usage_info in result.items():
        for info in usage_info:
            file_path = info['file_name']
            var_name = url[1] if isinstance(url, tuple) else None
            if var_name:
                usages = find_usages(file_path, var_name)
                print('POST CHECK ->', usages)
                for usage in usages:
                    line_no, method_name = usage
                    if 'lines_usage' not in info:
                        info['lines_usage'] = [line_no]
                    else:
                        info['lines_usage'].append( line_no )

                    if method_name:
                        if 'method_nm' not in info:
                            info['method_nm'] = [method_name]
                        else:
                            info['method_nm'].append( method_name )
                    else:
                        if 'method_nm' not in info:
                            info['method_nm'] = ['NA']
                        else:
                            info['method_nm'].append( 'NA' )

            else:
                usages = find_usages(file_path, url)
                print('POST CHECK2 ->', usages)
                for usage in usages:
                    line_no, method_name = usage
                    if 'lines_usage' not in info:
                        info['lines_usage'] = [line_no]
                    else:
                        info['lines_usage'].append( line_no )

                    if method_name:
                        if 'method_nm' not in info:
                            info['method_nm'] = [method_name]
                        else:
                            info['method_nm'].append( method_name )
                    else:
                        if 'method_nm' not in info:
                            info['method_nm'] = ['NA']
                        else:
                            info['method_nm'].append( 'NA' )

            if 'method_nm' in info: info['method_nm'] = list( set( info['method_nm'] ) )
            if 'lines_usage' in info: info['lines_usage'] = list( set( info['lines_usage'] ) )

    return result

if __name__ == "__main__":

    directory = '/datadrive/IKG/code_db/python/'
    result = analyze_codebase(directory)
    print(json.dumps( result, indent=4 ))


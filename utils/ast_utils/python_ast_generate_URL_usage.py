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

        for route_ in local_routes:
            for node in ast.walk( tree ):
              if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and contains_var_as_BinOP( route_, node.value ) and \
                            route_ not in urls:
                        urls.append( route_ )

    return urls

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
                for usage in usages:
                    line_no, method_name = usage
                    info['lines_usage'] = [line_no]
                    if method_name:
                        info['method_nm'] = method_name
                        info['method_begin_code_snippet'] = extract_method_code_snippet(file_path, method_name)
                        info['method_end_code_snippet'] = None
                    else:
                        info['method_nm'] = 'NA'
                        info['method_begin_code_snippet'] = 'NA'
                        info['method_end_code_snippet'] = 'NA'
            else:
                usages = find_usages(file_path, url)
                for usage in usages:
                    line_no, method_name = usage
                    info['lines_usage'] = [line_no]
                    if method_name:
                        info['method_nm'] = method_name
                        info['method_begin_code_snippet'] = extract_method_code_snippet(file_path, method_name)
                        info['method_end_code_snippet'] = None
                    else:
                        info['method_nm'] = 'NA'
                        info['method_begin_code_snippet'] = 'NA'
                        info['method_end_code_snippet'] = 'NA'
    return result

if __name__ == "__main__":

    directory = '/datadrive/IKG/code_db/python/'
    result = analyze_codebase(directory)
    print(json.dumps( result, indent=4 ))


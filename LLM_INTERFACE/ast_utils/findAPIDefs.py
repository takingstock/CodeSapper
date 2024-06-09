import ast
import os

class APIDefinitionFinder(ast.NodeVisitor):
    def __init__(self):
        self.api_definitions = []

    def visit_FunctionDef(self, node):
        for decorator in node.decorator_list:
            if isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Attribute):
                if decorator.func.attr == 'route':
                    # Extract the route path
                    route_path = None
                    if decorator.args and isinstance(decorator.args[0], ast.Str):
                        route_path = decorator.args[0].s
                    
                    # Extract the HTTP methods
                    methods = []
                    for keyword in decorator.keywords:
                        if keyword.arg == 'methods' and isinstance(keyword.value, ast.List):
                            for method in keyword.value.elts:
                                if isinstance(method, ast.Str):
                                    methods.append(method.s)
                    
                    self.api_definitions.append({
                        'name': node.name,
                        'lineno': node.lineno,
                        'end_lineno': node.body[-1].lineno,
                        'route_path': route_path,
                        'methods': methods
                    })
        self.generic_visit(node)

def parse_files_in_directory(directory):
    file_paths = []
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(".py"):
                file_paths.append(os.path.join(root, file))
    return file_paths

def parse_file(file_path):
    with open(file_path, "r") as source:
        return ast.parse(source.read(), filename=file_path)

def find_api_definitions_in_ast(tree):
    finder = APIDefinitionFinder()
    finder.visit(tree)
    return finder.api_definitions

def find_api_definitions(directory):
    api_definitions = []
    file_paths = parse_files_in_directory(directory)
    for file_path in file_paths:
        tree = parse_file(file_path)
        definitions = find_api_definitions_in_ast(tree)
        if definitions:
            for definition in definitions:
                definition['file_path'] = file_path
                api_definitions.append(definition)
    return api_definitions

if __name__ == "__main__":

    # Example usage
    api_definitions = find_api_definitions('/datadrive/IKG/LLM_INTERFACE/SRC_DIR/')
    for api in api_definitions:
        print(f"Found API definition {api['name']} at line {api['lineno']} ends {api['end_lineno']} in {api['file_path']}")
        print(f"Route path: {api['route_path']}")
        print(f"Methods: {api['methods']}")


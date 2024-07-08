import ast

# Sample code for testing
source_code = """
config_dict = {"SCALAR" : [7035, "http://10.0.8.154:4009"],
               "STAGING" : [7035, "https://aldstaging.amygbserver.in/"],
               "MARK_INFRA_PROD" : [7035, "http://162.31.17.199:4009"],
               "MARK_INFRA_STAGING" : [7035, "http://162.31.4.92:4009"]}

port = config_dict.get(ENV)[0]
backend_platform_url = config_dict.get(ENV)[1]

def some_function():
    local_url = backend_platform_url + "/api/v1/globalMapping/ocr?sortBy=docType&orderBy=DESC&tenantId=" + input1
"""

def extract_binop_values(node):
    """Recursively extract all values from a binary operation node."""
    if isinstance(node, ast.BinOp):
        left_values = extract_binop_values(node.left)
        right_values = extract_binop_values(node.right)
        return left_values + right_values
    elif isinstance(node, ast.Name):
        return [node.id]
    elif isinstance(node, ast.Constant):
        return [node.value]
    else:
        return []

def extract_assignments_from_dict(dict_node):
    """Extract all URLs from a dictionary node."""
    urls = []
    if isinstance(dict_node, ast.Dict):
        for value in dict_node.values:
            if isinstance(value, ast.List) and len(value.elts) > 1:
                if isinstance(value.elts[1], ast.Constant) and isinstance(value.elts[1].value, str):
                    urls.append(value.elts[1].value)
    return urls

def find_variable_assignments(source_code):
    tree = ast.parse(source_code)
    variable_assignments = {}

    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    value = node.value
                    if isinstance(value, ast.Name):
                        variable_assignments[target.id] = value.id
                    elif isinstance(value, ast.Constant):
                        variable_assignments[target.id] = value.value
                    elif isinstance(value, ast.BinOp):
                        variable_assignments[target.id] = extract_binop_values(value)
                    elif isinstance(value, ast.Call) and isinstance(value.func, ast.Attribute):
                        if value.func.attr == 'get' and len(value.args) > 0:
                            dict_var = value.func.value.id
                            key_var = value.args[0].id if isinstance(value.args[0], ast.Name) else None
                            if dict_var in variable_assignments and isinstance(variable_assignments[dict_var], dict):
                                if key_var:
                                    variable_assignments[target.id] = variable_assignments[dict_var].get(key_var, [])
                                else:
                                    variable_assignments[target.id] = extract_assignments_from_dict(variable_assignments[dict_var])
                    elif isinstance(value, ast.Dict):
                        variable_assignments[target.id] = extract_assignments_from_dict(value)
                    else:
                        variable_assignments[target.id] = ast.dump(value)
    
    return variable_assignments

def update_variable_assignments(assignments):
    """Update dictionary variable assignments with actual values."""
    for key, value in assignments.items():
        if isinstance(value, dict):
            assignments[key] = extract_assignments_from_dict(value)

def extract_id(node):
    if isinstance(node, ast.Name):
        return node.id
    elif isinstance(node, ast.Attribute):
        return node.attr
    elif isinstance(node, ast.Call):
        return extract_id(node.func)
    elif isinstance(node, ast.Subscript):
        return extract_id(node.value)
    elif isinstance(node, ast.Index):
        return extract_id(node.value)
    elif isinstance(node, ast.Constant):
        return node.value
    elif isinstance(node, ast.Str):
        return node.s
    elif isinstance(node, ast.List):
        return [extract_id(item) for item in node.elts]
    elif isinstance(node, ast.Tuple):
        return tuple(extract_id(item) for item in node.elts)
    # Add more cases for other AST node types as needed
    else:
        return None  # Handle unknown AST node types or raise an error

# Extract variable assignments
variable_assignments = find_variable_assignments(source_code)
update_variable_assignments(variable_assignments)
print("Variable Assignments:")
for var, value in variable_assignments.items():
    try:
      print( extract_id( parsed_value = ast.literal_eval(value) ) )
    except:
        pass
    print(f"{var} = {value}")

# Trace the variable globally
def trace_variable(variable_name, assignments):
    if variable_name in assignments:
        value = assignments[variable_name]
        if isinstance(value, list):
            return value
        elif isinstance(value, str):
            if value in assignments:
                return trace_variable(value, assignments)
            else:
                return [value]
    return []

# Find all URLs for the given variable
backend_urls = trace_variable('backend_platform_url', variable_assignments)


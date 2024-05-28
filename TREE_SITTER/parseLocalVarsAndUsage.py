from tree_sitter_languages import get_parser

parser = get_parser('python')

# Example Python code
import sys

with open( sys.argv[1], 'r' ) as fp:
    code_ = fp.readlines()

code = ( ''.join( code_ ) )

tree = parser.parse(bytes(code, "utf8"))

def get_global_variables_and_methods(tree):
    global_vars = []
    methods = []
    for node in tree.root_node.children:

        if node.type == 'expression_statement' and node.children[0].type == 'assignment':
            global_vars.append(node.children[0].children[0].text.decode('utf8'))

        elif node.type == 'function_definition':

            for fdef_children in node.children:
                print( 'FDEF->', fdef_children.children )
                if len( fdef_children.children ) == 0: continue
                
                for fdef_gc in fdef_children.children:
                    if fdef_gc.type in [ 'identifier', 'expression_statement' ] and len( fdef_gc.children ) > 0:
                        print( 'FDEF2->', fdef_gc.children[0].text.decode('utf8') )

            methods.append(node.children[1].text.decode('utf8'))
        elif node.type == 'with_statement':
            for child in node.children:
                if child.type == 'block' and child.children[0].type == 'expression_statement'\
                        and child.children[0].children[0].type == 'assignment':

                    global_vars.append( child.children[0].children[0].children[0].text.decode('utf8') )

    return global_vars, methods

global_vars, methods = get_global_variables_and_methods(tree)
print("Global Variables:", global_vars)
print("Methods:", methods)

def find_usages(tree, globals_and_methods):
    usages = {name: [] for name in globals_and_methods}
    cursor = tree.walk()
    stack = [cursor.node]

    while stack:
        node = stack.pop()
        if node.type == 'identifier':
            name = node.text.decode('utf8')
            if name in globals_and_methods and node.parent.type not in ( 'function_definition', 'parameters' ):
                print('Start point is tuple ? ', node.start_point, node.type )
                usages[name].append(node.start_point)
        stack.extend(node.children)

    return usages

# Combine globals and methods into a single list for searching
globals_and_methods = global_vars + methods

usages = find_usages(tree, globals_and_methods)
print("Usages:")
for name, usage_points in usages.items():
    print(f"{name}: {usage_points}")


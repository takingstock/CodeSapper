import ast, sys, time, textwrap

# Define a NodeVisitor class to traverse the AST
class CodeAnalyzer(ast.NodeVisitor):

    def __init__(self):
        self.ast_linewise_deets_ = dict()
        self.file_ptr_ = None
    
    def parse_ast( self, file_nm_, range_):
        self.file_ptr_ = open( file_nm_, 'r' )
        code = self.file_ptr_.readlines()[ range_[0]: range_[1] ]
        code = textwrap.dedent( ''.join( code ) )
        #code = '\n'.join( code )
        # Parse the code into an AST
        return ast.parse(code)
    
    def parse_ast_snippet( self, snippet_arr_):
        if '--' in snippet_arr_[-1] or '++' in snippet_arr_[-1]:
            local_snippet_ = snippet_arr_[:-1] # the last entry is always some thing like -- a/ ++ b/ 
        else:
            local_snippet_ = snippet_arr_

        code_snippet_ = textwrap.dedent( ''.join( local_snippet_ ) )
        parsed_ast = ast.parse( code_snippet_ )
        # Parse the code into an AST
        return parsed_ast

    def gc(self):
        if self.file_ptr_ != None:
            self.file_ptr_.close()

    def visit_Assign(self, node):
        targets = []
        function_name = self.get_function_name( node.value )

        value = node.value
        value_names = self.get_names(value)

        for target in node.targets:
            if isinstance(target, ast.Name):
                # Single variable assignment
                #print(f"Assignment to variable: {target.id}")
                targets.append( target.id )
            elif isinstance(target, ast.Tuple):
                # Tuple assignment
                for element in target.elts:
                    if isinstance(element, ast.Name):
                        #print(f"Assignment to variable in tuple: {element.id}")
                        targets.append( element.id )
                    # Handle nested tuples if necessary
                    elif isinstance(element, ast.Tuple):
                        self._handle_nested_tuple( element, targets )

        self.ast_linewise_deets_[ node.lineno ] = { 'Type':'Assignment', 'Targets': targets,\
                'Ending': 'NA', 'Values': value_names, 'Function': function_name }
        self.generic_visit(node)

    def get_function_name(self, value):
        if isinstance(value, ast.Call):
            # Extract function name
            if isinstance(value.func, ast.Name):
                return value.func.id
            elif isinstance(value.func, ast.Attribute):
                return value.func.attr
        return "NA"
    
    def _handle_nested_tuple( self, tuple_node, targets ):
        for element in tuple_node.elts:
            if isinstance(element, ast.Name):
                #print(f"Assignment to variable in nested tuple: {element.id}")
                targets.append( element.id )
            elif isinstance(element, ast.Tuple):
                self._handle_nested_tuple(element)        

    def visit_If(self, node):
        # Handle if statements
        test_names = self.get_names(node.test)
        #print(f"If statement: Line {node.lineno}, End {node.body[-1].lineno} ,Condition Variables: {test_names}")
        self.ast_linewise_deets_[ node.lineno ] = { 'Type':'If Statement', 'Targets': test_names , \
                                                     'Ending': node.body[-1].lineno, 'Values': 'NA' }
        self.generic_visit(node)

    def visit_For(self, node):
        # Handle for loops
        target = node.target.id if isinstance(node.target, ast.Name) else str(node.target)
        iter_names = self.get_names(node.iter)
        self.ast_linewise_deets_[ node.lineno ] = { 'Type':'For loop', 'Targets': iter_names, \
                                                    'Ending': node.body[-1].lineno, 'Values': 'NA' }
        #print(f"For loop: Line {node.lineno}, End {node.body[-1].lineno} ,Loop Variable: {target}, Iterating Over: {iter_names}")
        self.generic_visit(node)

    def get_names(self, node):
        # Helper function to extract variable names from nodes
        if isinstance(node, ast.Name):
            return [node.id]
        elif isinstance(node, ast.BinOp):
            return self.get_names(node.left) + self.get_names(node.right)
        elif isinstance(node, ast.BoolOp):
            names = []
            for value in node.values:
                names.extend(self.get_names(value))
            return names
        elif isinstance(node, ast.Compare):
            names = self.get_names(node.left)
            for comp in node.comparators:
                names.extend(self.get_names(comp))
            return names
        elif isinstance(node, ast.Call):
            names = self.get_names(node.func)
            for arg in node.args:
                names.extend(self.get_names(arg))
            return names
        elif isinstance(node, ast.Attribute):
            return self.get_names(node.value) + [node.attr]
        elif isinstance(node, ast.Subscript):
            return self.get_names(node.value) + self.get_names(node.slice)
        elif isinstance(node, (ast.List, ast.Tuple, ast.Set)):
            names = []
            for elt in node.elts:
                names.extend(self.get_names(elt))
            return names
        elif isinstance(node, ast.Dict):
            names = []
            for key in node.keys:
                names.extend(self.get_names(key))
            for value in node.values:
                names.extend(self.get_names(value))
            return names
        else:
            return []

if __name__ == "__main__":
    # Instantiate the analyzer and visit the AST nodes
    analyzer = CodeAnalyzer()
    analyzer.visit(parsed_ast)

    print( analyzer.ast_linewise_deets_ )
    print( 'DOMU->', time.time() - start_ )

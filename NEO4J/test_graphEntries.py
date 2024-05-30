from neo4j import GraphDatabase

# Define the Neo4j connection details
uri = "bolt://localhost:7687"
username = "neo4j"
password = "slayer#666"

# Create a Neo4j driver instance
driver = GraphDatabase.driver(uri, auth=(username, password))

def list_nodes(tx):
    query = "MATCH (n) RETURN labels(n) AS labels, n LIMIT 25"
    result = tx.run(query)
    for record in result:
       print(f"Labels: {record['labels']}, Node: {record['n']}")
    return result

def list_relationships(tx):
    query = "MATCH (a)-[r]->(b) RETURN type(r) AS type, a , b LIMIT 50"
    result = tx.run(query)
    for record in result:
       print(f"Type: {record['type']}, Relationship: {record['a']}<--->{record['b']}")
    return result

def count_nodes(tx):
    query = "MATCH (n) RETURN count(n) AS node_count"
    result = tx.run(query)
    return result.single()["node_count"]

def count_relationships(tx):
    query = "MATCH ()-[r]->() RETURN count(r) AS relationship_count"
    result = tx.run(query)
    return result.single()["relationship_count"]

def main():
    with driver.session() as session:
        print("Listing Nodes:")
        nodes = session.execute_read(list_nodes)

        print("\nListing Relationships:")
        relationships = session.execute_read(list_relationships)

        node_count = session.execute_read(count_nodes)
        relationship_count = session.execute_read(count_relationships)
        print(f"\nTotal Nodes: {node_count}")
        print(f"Total Relationships: {relationship_count}")

if __name__ == "__main__":
    main()
    driver.close()


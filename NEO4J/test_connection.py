from neo4j import GraphDatabase

#uri = "neo4j://localhost:7689"
uri = "bolt://localhost:7687"
username = "neo4j"
password = "slayer#666"

driver = GraphDatabase.driver(uri, auth=(username, password))

def test_connection():
    with driver.session() as session:
        result = session.run("CALL gds.list();")
        for record in result:
            print(record)

try:
    test_connection()
    print("Connection successful")
except Exception as e:
    print(f"Connection failed: {e}")

driver.close()



installation_dir_=$(pwd)

export NEO4J_CONFIG="$installation_dir_/NEO4J/config.json"
export AST_CONFIG="$installation_dir_/config/python/ast_config.json"
export CODE_DB="$installation_dir_/code_db/"
export TEST_PLAN_CONFIG="$installation_dir_/utils/test_utils/"
export GRAPH_UTILS_FOLDER="$installation_dir_/utils/graph_utils/"
export AST_UTILS_FOLDER="$installation_dir_/utils/ast_utils/"
export DAEMON_CONFIG="$installation_dir_/config/daemon_config.json"
export IKG_HOME="$installation_dir_/"
export GITHUB_TOKEN="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"
export REPO_OWNER="AmyGB-ai"
export REPO_NAME="IKG"
export GITHUB_MON_PATH="$installation_dir_/utils/"
export LLM_CONFIG_PATH="$installation_dir_/utils/LLM_INTERFACE/llm_config.json"
export LLM_MODEL="LLAMA"

# Install Python libraries
echo "Installing Python libraries..."
pip install -r requirements.txt

## NEO4J
echo "Neo4j installation..."
sudo systemctl stop neo4j

# Uninstall Neo4j
sudo apt purge neo4j -y
sudo rm -rf /etc/neo4j
sudo rm -rf /var/lib/neo4j

echo "Neo4j uninstallation complete."

# Install JDK 17 if not already installed
if ! command -v java &> /dev/null; then
    echo "Installing OpenJDK 21..."
    sudo apt update
    sudo apt install openjdk-21-jdk -y
    echo "Java installed. Setting JAVA_HOME..."
    export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
    echo "export JAVA_HOME=$JAVA_HOME" >> ~/.bashrc
    source ~/.bashrc
else
    echo "Java (OpenJDK 21) is already installed."
fi

# Verify JDK version
echo "Checking Java version..."
java -version

# Install Neo4j
echo "Installing Neo4j..."
wget -O - https://debian.neo4j.com/neotechnology.gpg.key | sudo apt-key add -
echo 'deb https://debian.neo4j.com stable 4.4' | sudo tee /etc/apt/sources.list.d/neo4j.list
sudo apt update
sudo apt install neo4j -y

# Configure Neo4j to disable authentication
echo "Configuring Neo4j to disable authentication..."
sudo sed -i 's/#dbms.security.auth_enabled=true/dbms.security.auth_enabled=false/' /etc/neo4j/neo4j.conf
sudo sed -i 's/#dbms.security.auth_enabled=false/dbms.security.auth_enabled=false/' /etc/neo4j/neo4j.conf

# Restart Neo4j
sudo systemctl restart neo4j

echo "Neo4j installation and configuration completed without authentication."

## start code scanner
echo "starting code scanner"
nohup python $installation_dir_/utils/ast_utils/python_ast_daemon.py &> $installation_dir_/local-directory/code_scanner&
echo "starting github monitor"
nohup python $installation_dir_/utils/github_monitor.py &> $installation_dir_/local-directory/github_monitor&
echo "starting flask application"
nohup python $installation_dir_/UX/app.py &> $installation_dir_/local-directory/flask_app&


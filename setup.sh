
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

## export from bashrc
sudo bash -c "echo 'export NEO4J_CONFIG=\"$installation_dir_/NEO4J/config.json\"' >> ~/.bashrc"
sudo bash -c "echo 'export AST_CONFIG=\"$installation_dir_/config/python/ast_config.json\"' >> ~/.bashrc"
sudo bash -c "echo 'export CODE_DB=\"$installation_dir_/code_db/\"' >> ~/.bashrc"
sudo bash -c "echo 'export TEST_PLAN_CONFIG=\"$installation_dir_/utils/test_utils/\"' >> ~/.bashrc"
sudo bash -c "echo 'export GRAPH_UTILS_FOLDER=\"$installation_dir_/utils/graph_utils/\"' >> ~/.bashrc"
sudo bash -c "echo 'export AST_UTILS_FOLDER=\"$installation_dir_/utils/ast_utils/\"' >> ~/.bashrc"
sudo bash -c "echo 'export DAEMON_CONFIG=\"$installation_dir_/config/daemon_config.json\"' >> ~/.bashrc"
sudo bash -c "echo 'export IKG_HOME=\"$installation_dir_/\"' >> ~/.bashrc"
sudo bash -c "echo 'export GITHUB_TOKEN=\"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\"' >> ~/.bashrc"
sudo bash -c "echo 'export REPO_OWNER=\"AmyGB-ai\"' >> ~/.bashrc"
sudo bash -c "echo 'export REPO_NAME=\"IKG\"' >> ~/.bashrc"
sudo bash -c "echo 'export GITHUB_MON_PATH=\"$installation_dir_/utils/\"' >> ~/.bashrc"
sudo bash -c "echo 'export LLM_CONFIG_PATH=\"$installation_dir_/utils/LLM_INTERFACE/llm_config.json\"' >> ~/.bashrc"
sudo bash -c "export LLM_MODEL=\"LLAMA\"' >> ~/.bashrc"

# Install Python libraries
echo "Installing Python libraries..."
pip install -r requirements.txt > $installation_dir_/local-directory/pylib_installation

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
    echo "Installing OpenJDK 17..."
    sudo apt update
    sudo apt install openjdk-17-jdk -y
    echo "Java installed. Setting JAVA_HOME..."
    export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
    echo "export JAVA_HOME=$JAVA_HOME" >> ~/.bashrc
    source ~/.bashrc
else
    echo "Java (OpenJDK 17) is already installed."
fi

# Verify JDK version
echo "Checking Java version..."
java -version

sudo mkdir -P /var/lib/neo4j/plugins
# Install Neo4j
echo "Installing Neo4j..."
wget -O - https://debian.neo4j.com/neotechnology.gpg.key | sudo apt-key add -
echo 'deb https://debian.neo4j.com stable latest' | sudo tee /etc/apt/sources.list.d/neo4j.list
sudo apt update
sudo apt install neo4j -y

# Configure Neo4j to disable authentication
echo "Configuring Neo4j to disable authentication..."
sudo sed -i 's/#dbms.security.auth_enabled=true/dbms.security.auth_enabled=false/' /etc/neo4j/neo4j.conf
sudo sed -i 's/#dbms.security.auth_enabled=false/dbms.security.auth_enabled=false/' /etc/neo4j/neo4j.conf


# Download and install the GDS library
sudo wget https://github.com/neo4j/graph-data-science/releases/download/2.6.7/neo4j-graph-data-science-2.6.7.jar -P /var/lib/neo4j/plugins

# Download and install the APOC library
sudo wget https://github.com/neo4j/apoc/releases/download/5.20.0/apoc-5.20.0-core.jar -P /var/lib/neo4j/plugins

# Update Neo4j configuration to enable GDS procedures
sudo bash -c 'echo "dbms.security.procedures.unrestricted=apoc.*,gds.*" >> /etc/neo4j/neo4j.conf'
sudo bash -c 'echo "dbms.security.procedures.allowlist=apoc.*,gds.*" >> /etc/neo4j/neo4j.conf'

CONF_FILE="/etc/neo4j/apoc.conf"
# Create the apoc.conf file with the specified entries
sudo tee ${CONF_FILE} > /dev/null <<EOF
apoc.trigger.enabled=true
apoc.jdbc.neo4j.url="jdbc:foo:bar"
apoc.import.file.enabled=true
apoc.export.file.enabled=true
dbms.security.procedures.unrestricted=apoc.*
dbms.security.procedures.allowlist=apoc.*
dbms.security.procedures.unrestricted=gds.*
dbms.security.procedures.allowlist=gds.*
EOF

# Ensure correct permissions (optional, but recommended)
sudo chmod 644 ${CONF_FILE}

# Restart Neo4j
sudo systemctl restart neo4j

echo "Neo4j installation and configuration completed without authentication."

echo "Script to sleep for 20 seconds to ensure neo4j is up and running !"
sleep 20

## start code scanner
echo "starting code scanner"
nohup python $installation_dir_/utils/ast_utils/python_ast_daemon.py &> $installation_dir_/local-directory/code_scanner&
echo "starting github monitor"
nohup python $installation_dir_/utils/github_monitor.py &> $installation_dir_/local-directory/github_monitor&
echo "starting flask application"
nohup python $installation_dir_/UX/app.py &> $installation_dir_/local-directory/flask_app&


# Check if /datadrive directory exists; create if not
if [ ! -d "/datadrive" ]; then
    echo "Creating /datadrive directory..."
    sudo mkdir -p /datadrive
fi

# Ensure /datadrive directory has correct permissions (777)
sudo chmod 777 /datadrive

# Create IKG directory within /datadrive
sudo mkdir -p /datadrive/IKG

echo "/datadrive/IKG directory created."
# Clone IKG repository into /datadrive/IKG
echo "Cloning IKG repository..."
sudo git clone --branch master --single-branch https://github.com/AmyGB-ai/IKG.git /datadrive/IKG

echo "IKG repository cloned."

echo "Setting up environment variables..."

export NEO4J_CONFIG="/datadrive/IKG/NEO4J/config.json"
export AST_CONFIG="/datadrive/IKG/config/python/ast_config.json"
export TEST_PLAN_CONFIG="/datadrive/IKG/utils/test_utils/"
export GRAPH_UTILS_FOLDER="/datadrive/IKG/utils/graph_utils/"
export AST_UTILS_FOLDER="/datadrive/IKG/utils/ast_utils/"
export DAEMON_CONFIG="/datadrive/IKG/config/daemon_config.json"
export IKG_HOME="/datadrive/IKG/"
export GITHUB_TOKEN="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"
export REPO_OWNER="AmyGB-ai"
export REPO_NAME="IKG"
export GITHUB_MON_PATH="/datadrive/IKG/utils/"
export LLM_CONFIG_PATH="/datadrive/IKG/utils/LLM_INTERFACE/llm_config.json"
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
nohup python /datadrive/IKG/utils/ast_utils/python_ast_daemon.py &> /datadrive/IKG/local-directory/code_scanner&
echo "starting github monitor"
nohup python /datadrive/IKG/utils/github_monitor.py &> /datadrive/IKG/local-directory/github_monitor&
echo "starting flask application"
nohup python /datadrive/IKG/UX/app.py &> /datadrive/IKG/local-directory/flask_app&


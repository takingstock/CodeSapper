installation_dir_=$(pwd)
## export from bashrc
echo "export NEO4J_CONFIG=\"$installation_dir_/NEO4J/config.json\"" >> ~/.bashrc
echo "export AST_CONFIG=\"$installation_dir_/config/python/ast_config.json\"" >> ~/.bashrc
echo "export CODE_DB=\"$installation_dir_/code_db/\"" >> ~/.bashrc
echo "export TEST_PLAN_CONFIG=\"$installation_dir_/utils/test_utils/\"" >> ~/.bashrc
echo "export GRAPH_UTILS_FOLDER=\"$installation_dir_/utils/graph_utils/\"" >> ~/.bashrc
echo "export AST_UTILS_FOLDER=\"$installation_dir_/utils/ast_utils/\"" >> ~/.bashrc
echo "export DAEMON_CONFIG=\"$installation_dir_/config/daemon_config.json\"" >> ~/.bashrc
echo "export IKG_HOME=\"$installation_dir_/\"" >> ~/.bashrc
echo "export REPO_OWNER=\"AmyGB-ai\"" >> ~/.bashrc
echo "export REPO_NAME=\"IKG\"" >> ~/.bashrc
echo "export GITHUB_MON_PATH=\"$installation_dir_/utils/\"" >> ~/.bashrc
echo "export LLM_CONFIG_PATH=\"$installation_dir_/utils/LLM_INTERFACE/llm_config.json\"" >> ~/.bashrc
echo "export LLM_MODEL=\"LLAMA\"" >> ~/.bashrc


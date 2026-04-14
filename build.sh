#!/bin/bash
set -e
RED='\033[0;31m';GREEN='\033[0;32m';AMBER='\033[0;33m';BOLD='\033[1m';RESET='\033[0m'
echo -e "${BOLD}${AMBER}  ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗\n ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝\n ██║     ██║     ███████║██║   ██║██║  ██║█████╗  \n ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝  \n ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗\n  ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝${RESET}"
echo -e "${BOLD} TERMINAL  ·  agentdata.pro  ·  macOS Build${RESET}\n"
if [[ "$(uname -s)" != "Darwin" ]];then echo -e "${RED}✗ macOS only.${RESET}";exit 1;fi
echo -e "${GREEN}✓ macOS $(sw_vers -productVersion)${RESET}"
if ! command -v node &>/dev/null;then echo -e "${RED}✗ Node.js not found. Install: https://nodejs.org${RESET}";exit 1;fi
NV=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [[ $NV -lt 20 ]];then echo -e "${RED}✗ Node.js >= 20 required (found $NV). https://nodejs.org${RESET}";exit 1;fi
echo -e "${GREEN}✓ Node.js $(node --version)${RESET}"
if ! xcode-select -p &>/dev/null;then echo -e "${AMBER}⚠ Installing Xcode CLT...${RESET}";xcode-select --install;echo -e "${AMBER}Complete CLT install, then re-run build.sh${RESET}";exit 1;fi
echo -e "${GREEN}✓ Xcode CLT${RESET}"
echo -e "\n${BOLD}[1/5] npm install...${RESET}";npm install;echo -e "${GREEN}✓${RESET}"
echo -e "\n${BOLD}[2/5] Generating icon...${RESET}";python3 scripts/gen_icon.py;echo -e "${GREEN}✓${RESET}"
echo -e "\n${BOLD}[3/5] Building renderer...${RESET}";npm run build:renderer;echo -e "${GREEN}✓${RESET}"
echo -e "\n${BOLD}[4/5] Compiling Electron...${RESET}";npm run build:electron;echo -e "${GREEN}✓${RESET}"
echo -e "\n${BOLD}[5/5] Packaging DMG...${RESET}";npx electron-builder --mac dmg
DMG=$(find release -name '*.dmg' 2>/dev/null|head -1)
if [[ -z "$DMG" ]];then echo -e "${RED}✗ DMG not found in release/${RESET}";exit 1;fi
echo -e "\n${GREEN}${BOLD}✓ Done! DMG: $DMG${RESET}"
echo -e "${AMBER}Copy to Mac and double-click to install.${RESET}\n"
open release/ 2>/dev/null||true

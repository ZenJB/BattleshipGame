echo "Configurando..."
echo "Instalador compativel somente com distro Debian e Ubuntu do Linux"
echo "Instalando o unzip no sistema..."
sudo apt-get install unzip -y
echo "Instalando o make..."
sudo apt install make -y
echo "Instalando o build essencial..."
sudo apt-get install build-essential -y
echo "Instalando o python..."
sudo apt-get install python -y
echo "Feito!"
curl -LOk https://github.com/ZenJB/BattleshipGame/archive/master.zip
unzip master.zip
mv BattleshipGame-master grupo10_acr_p2
rm master.zip
cd grupo10_acr_p2
npm install -g node-gyp
npm install -g nodemon
npm i
chmod +x start.sh
mkdir config
cd config
openssl req -newkey rsa:2048 -nodes -keyout private.key -x509 -days 365 -out certificate.crt

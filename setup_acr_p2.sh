echo "Configurando..."
curl -LOk https://github.com/ZenJB/BattleshipGame/archive/master.zip
unzip master.zip
mv BattleshipGame-master grupo10_acr_p2
rm master.zip
cd grupo10_acr_p2
npm install -g node-gyp
npm i
cd config
openssl req -nodes -new -x509 -keyout private.key -out certificate.crt
cd ..
echo "Setup terminado!"
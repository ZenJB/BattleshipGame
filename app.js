//#region Dependências
var express = require('express');
var cookieParser = require('cookie-parser');
let express_session = require('express-session');
//Fix Express-Session memory leak issue
let memorystore = require('memorystore')(express_session);
let https = require('https');
let path = require('path');
let fs = require('fs');

var ejs = require('ejs');
var socketio = require('socket.io');
let socketio_session = require('express-socket.io-session');
const db = require('better-sqlite3')('database.db');
const bcrypt = require('bcrypt');
//#endregion

//#region Project Configuration
let configuracao = {
    porta: 3001,
    certificados: {
        cert: fs.readFileSync(path.join(__dirname, 'config', 'certificate.crt')),
        key: fs.readFileSync(path.join(__dirname, 'config', 'private.key'))

    },
    passwords: {
        session: 'ncopwhj82uhn3'
    }

};
//#endregion

let app     = express();
let server  = https.createServer(configuracao.certificados, app);
var io = socketio(server);

//#region Express middleware
app.set('view engine','ejs');
app.set('views',__dirname+'/views');
app.use(express.static('static'));
app.use(express.urlencoded( { extended: false}));
app.use(express.json());
app.use(cookieParser());
let session = express_session({
    name : 'ACR_P2_GRUPO_10',
    secret: configuracao.passwords.session,
    saveUninitialized: true,
    resave: true,
    store: new memorystore({
        checkPeriod: 86400000 //Cookies validos para 1 dia somente
    }),
    cookie: {
        secure: true,   //Requerer https para os cookies
        maxAge: 86400000 //Cookies validos para 1 dia somente
    }
});
app.use(session);
io.use(socketio_session(session, {
    autoSave:true
})); 
//#endregion

//#region Funções auxiliares
//Retorna se o utilizador tem a sessão iniciada ou não
const temSessaoIniciada = (req) => {
    if(req.session.username != null)
        return true;
    else
        return false;
}
//#endregion


//Pagina incial
app.get('/',(req,res) => {
    console.log('[GET] /');
    if(req.session.username == undefined){
        res.render('index', {loggedIn: false, username: req.session.username});
    }else
        res.render('index', {loggedIn: true, username: req.session.username});
});

//Pagina da configuração do tabuleiro
app.get('/game', (req,res) => {
    let username = req.session.username;
    if(username === undefined)
        res.redirect('/');
    else{
        console.log("[GET] /game by "+username);
        let query = db.prepare("SELECT id, player1, player2 FROM games WHERE terminado = '0' AND (player1 = ? OR player2 = ?);").get(username,username);
        if(query === undefined){
            res.redirect('/');
            return;
        }
        res.render('game', {gameID: query.id, player1: query.player1, player2: query.player2, currentUser: username});
    }
});

//Pagina do jogo em si
app.get('/game2', (req,res) => {
    let username = req.session.username;
    if(username === undefined)
        res.redirect('/');
    else{
        console.log("[GET] /game2 by "+username);
        let query = db.prepare("SELECT * FROM games WHERE terminado = '0' AND (player1 = ? OR player2 = ?);").get(username,username);
        let numJogador;
        if(query === undefined){
            res.redirect('/');
            return;
        }
        let turno = JSON.parse(query.gameInfo).aJogar;
        if(query.player1 === username)
            numJogador = 1;
        else
            numJogador = 2;
        let inimigo = (numJogador === 1)?2:1;
        //#region Processar os navios
        let boat_location = JSON.parse(query.boat_location)["jogador"+inimigo];
        let navios = {
            'Carrier':      
                        {
                            0: '',
                            1: '',
                            2: '',
                            3: '',
                            4: ''
                        }, //5 buracos
            'Battleship':
                        {
                            0: '',
                            1: '',
                            2: '',
                            3: ''
                        }, //4 buracos
            'Cruiser': 
                        {
                            0: '',
                            1: '',
                            2: ''
                        }, //3 buracos
            'Submarine':
                        {
                            0: '',
                            1: '',
                            2: ''
                        }, //3 buracos
            'Destroyer':  
                        {
                            0: '',
                            1: ''
                        } //2 buracos
            }
            
            for(var navio in navios){
                //O x é uma string e o y um numero
                let frente = {
                    x: boat_location[navio].frente[1],
                    y: boat_location[navio].frente[0]
                }
                let tras = {
                    x: boat_location[navio].tras[1],
                    y: boat_location[navio].tras[0]
                }
                //Se o navio estiver na vertical
                if(frente.x === tras.x){
                    let menorValor = (frente.y < tras.y)? frente.y:tras.y;

                    for(var i = 0; i < boat_location[navio].tamanho;i++)
                    {
                        let tmp_y = parseInt(menorValor)+i;
                        navios[navio][i] = tmp_y + '' + frente.x;
                    }
                }else
                //Se o navio estiver na horizontal
                if(frente.y === tras.y)
                {
                    let frente_x    = frente.x.charCodeAt(0);
                    let tras_x      = tras.x.charCodeAt(0);
                    let menorValor  = (frente_x < tras_x)? frente_x : tras_x;

                    for(var i = 0; i < boat_location[navio].tamanho;i++)
                    {
                        let tmp_x = menorValor+i;
                        navios[navio][i] = frente.y + '' + String.fromCharCode(tmp_x);
                    }
                    
                }

            }
        //#endregion

        res.render('game2', {
            gameID          : query.id, 
            player1         : query.player1, 
            player2         : query.player2, 
            currentUser     : username,
            tipoDeJogador   : numJogador,
            turno           : turno,
            boat_location: JSON.stringify(navios)
        });
    }
});

//Menu do jogo
app.get('/menu', (req,res) => {
    let username = req.session.username;
    if(username === undefined)
        res.redirect('/');
    else{
        console.log("[GET] /menu by "+username);
        res.render('menu', {username: username});
    }
});

//API para efetuar o login
app.post('/api/login', (req,res) => {
    if(temSessaoIniciada(req)){
        res.header(401).end(JSON.stringify({ code: false, username: ''}));
        return;
    }

    console.log("[POST] /api/login");
    let username = req.body.username;
    let password = req.body.password;
    const user = db.prepare('SELECT username,password FROM utilizadores WHERE username=?').get(username);
    if(bcrypt.compareSync(password, user.password)) {
        req.session.username = username;
        req.session.save();
        console.log(`([POST] /api/login) O utilizador ${username} iniciou sessão!`);
        res.header(200).end(JSON.stringify({ code: true, username: username}));
    } else {
        console.log(`([POST] /api/login) Inicio de sessão falhado (${username})!`);
        res.header(401).end(JSON.stringify({ code: false, username: username}));
    }
});

//API para se registar
app.post('/api/register', (req,res) => {
    if(temSessaoIniciada(req)){
        res.header(401).end(JSON.stringify({ code: false, username: ''}));
        return;
    }
    console.log("[POST] /api/register");

    let username = req.body.username;
    let password = req.body.password;

    //Se algum dos parametro vem vazio, não avançar
    if(username === undefined || password === undefined || password === '' || username === ''){
        res.header(401).end(JSON.stringify({ code: false, username: ''}));
        return;
    }

    //Verificar se o utilizador já existe
    const userExists = db.prepare('SELECT username,password FROM utilizadores WHERE username=?').get(username);
    if(userExists !== undefined){
        res.header(200).end(JSON.stringify({ code: false, username: ''}));
        return;
    }

    //Inserir o utilizador na base de dados
    const insertTheNewUser = db.prepare('INSERT INTO utilizadores (username, password) VALUES (?, ?)')
                               .run(username, bcrypt.hashSync(password, 10));
    
    //Iniciar sessão
    req.session.username = username;
    req.session.save();
    console.log(`([POST] /api/register) Utilizador ${username} registado!`);

    res.header(200).end(JSON.stringify({ code: true, username: username}));
});

//Terminar sessão
app.post('/api/logout', (req,res) => {
    console.log("[POST] /api/logout");

    req.session.username = undefined;
    res.header(200).end(JSON.stringify({ code: true, username: ''}));
});

//Verificar se estou com a sessão iniciada
app.post('/api/loggedIn', (req, res) => {
    console.log("[POST] /api/loggedIn");

    res.header(200).end(temSessaoIniciada(req));
});

//Junta-se a uma partida
app.post('/api/game/join', (req,res) => {
    if(!temSessaoIniciada(req)){
        res.header(401).end(JSON.stringify({ code: false, username: ''}));
        return;
    }
    
    let player = req.session.username;

    console.log("[POST] /api/game/join by "+player);

    let gameID = req.body.gameID;
    let query = db.prepare("UPDATE games SET player2 = ? WHERE id = ?;").run(player,gameID);
    console.log(`([POST] /api/game/join) Utilizador ${player} juntou-se a sessão ${gameID}!`);
    
    let query2 = db.prepare("SELECT player1 FROM games WHERE id = ?;").get(gameID);
    io.emit('GameTracker_'+query2.player1,'Player2Joined');
    res.header(200).end(JSON.stringify({ code: true}));
});

app.post('/api/game/create', (req,res) => { 
    if(!temSessaoIniciada(req)){
        res.header(401).end(JSON.stringify({ code: false, username: ''}));
        return;
    }
    
    let player = req.session.username;
    console.log("[POST] /api/game/create by "+player);

    //#region Layout do tabuleiro
    let tabuleiroLayout = {};
    for(let i = 1; i <= 9; i++){
        let linha = {};
        for(let p = 65; p <=75;p++){
            linha[String.fromCharCode(p).toUpperCase()] = 0;
        }
        tabuleiroLayout[i] = linha;
    }
    //#endregion
    //#region Estrutura do gameInfo a ser salvo na base de dados
    let gameInfoStructure = {
        jogador1: {
            tabuleiro: '',
            radar: tabuleiroLayout
        },
        jogador2: {
            tabuleiro: '',
            radar: tabuleiroLayout
        },
        aJogar: 1
    };
    let boat_location = {
        jogador1: '',
        jogador2: ''
    };
    //#endregion

    //Tentar criar o novo jogo
    try{
        let query = db.prepare("INSERT INTO games(player1,gameInfo,boat_location) VALUES (?,?,?);")
        .run(player,JSON.stringify(gameInfoStructure),JSON.stringify(boat_location));
        console.log(`([POST] /api/game/create) Utilizador ${player} criou uma sessão ${query.lastInsertRowid}!`);
        res.header(200).end(JSON.stringify({ code: true, gameID: query.lastInsertRowid}));
    }catch(e){
        console.log(`([POST] /api/game/create) Falhar ao criar uma sessão (utilizador ${player})`);
        console.log(e);
        res.header(200).end(JSON.stringify({ code: false}));
    }
});

app.post('/api/game/cancel', (req,res) => {
    if(!temSessaoIniciada(req)){
        res.header(401).end(JSON.stringify({ code: false, username: ''}));
        return;
    }
    
    let gameID = req.body.gameID;

    console.log("[POST] /api/game/cancel by "+player);

    //Cancelar um jogo criado
    let query = db.prepare("DELETE FROM games WHERE id = ?;").run(gameID);
    console.log(`([POST] /api/game/cancel) O utilizador ${player} cancelou a sessão ${gameID}!`);
    res.header(200).end(JSON.stringify({ code: true}));
});

app.post('/api/game/amIPlaying', (req,res) => {
    if(!temSessaoIniciada(req)){
        res.header(401).end(JSON.stringify({ code: false, username: ''}));
        return;
    }

    let player = req.session.username;
    console.log("([POST] /api/game/amIPlaying) O utilizador "+player+" perguntou se estava a jogar");

    let query = db.prepare("SELECT COUNT(*) AS numero FROM games WHERE terminado = '0' AND (player1 = ? OR player2 = ?);").get(player,player);
    if(query.numero > 0){
        res.header(200).end(JSON.stringify({ code: true}));
        console.log("([POST] /api/game/amIPlaying) Resposta: sim");
    }else{
        console.log("([POST] /api/game/amIPlaying) Resposta: não");
        res.header(200).end(JSON.stringify({ code: false}));
    }
});

app.post('/api/game/bothPlayersHaveSetupBoard', (req,res) => {
    if(!temSessaoIniciada(req)){
        res.header(401).end(JSON.stringify({ code: false, username: ''}));
        return;
    }

    console.log("[POST] /api/game/bothPlayersHaveSetupBoard by "+req.session.username);
    let gameID = req.body.gameID;

    //Informação daquele jogo
    let gameInfo = db.prepare('SELECT gameInfo FROM games WHERE id = ?;').get(gameID);
    let tabuleiro_na_db = JSON.parse( gameInfo.gameInfo );
    if(tabuleiro_na_db.jogador1.tabuleiro !== "" && tabuleiro_na_db.jogador2.tabuleiro !== ""){
        console.log("([POST] /api/game/bothPlayersHaveSetupBoard) [JOGO "+gameID+"] Ambos já configuraram o tabuleiro!");
        res.header(200).end(JSON.stringify({ code: true}));
    }else{
        let player1 = tabuleiro_na_db.jogador1.tabuleiro !== "";
        let player2 = tabuleiro_na_db.jogador2.tabuleiro !== "";
        console.log("([POST] /api/game/bothPlayersHaveSetupBoard) [JOGO "+gameID+"] Um dos jogadores não configurou o tabuleiro");
        console.log("Jogador 1: "+player1);
        console.log("Jogador 2: "+player2);
        res.header(200).end(JSON.stringify({ code: false, player1: player1, player2: player2}));
    }


});

app.post('/api/game/saveLayout', (req,res) => {
    //Nome do jogador
    let player = req.session.username;
    //ID do jogo
    let gameID = req.body.gameID;
    //Se é o jogador 1 ou 2
    let playerNumber = req.body.playerNumber;
    //Tabuleiro do jogador
    let tabuleiro = req.body.tabuleiro;
    //Localização dos seus barcos
    let meusBarcos = JSON.parse(req.body.meusBarcos);
    console.log("[POST] /api/game/saveLayout by "+player);
    /* === meusBarcos ===
    {
        jogador1: {
            'Carrier':      {'frente': null, 'tras': null, 'tamanho': 5}, //5 buracos
            'Battleship':   {'frente': null, 'tras': null, 'tamanho': 4}, //4 buracos
            'Cruiser':      {'frente': null, 'tras': null, 'tamanho': 3}, //3 buracos
            'Submarine':    {'frente': null, 'tras': null, 'tamanho': 3}, //3 buracos
            'Destroyer':    {'frente': null, 'tras': null, 'tamanho': 2}  //2 buracos
        }
    }
    */

    if(!temSessaoIniciada(req)){
        res.header(401).end(JSON.stringify({ code: false, username: ''}));
        return;
    }

    //Verificar que um jogo está a decorrer
    let query = db.prepare("SELECT COUNT(*) AS numero FROM games WHERE terminado = '0' AND player1 = ? OR player2 = ?").get(player,player);
    if(query.numero <= 0){
        res.header(200).end(JSON.stringify({ code: false}));
        return;
    }

    //Obter informação daquele jogo
    let gameInfo = db.prepare('SELECT * FROM games WHERE id = ?;').get(gameID);
    let tabuleiro_na_db = JSON.parse( gameInfo.gameInfo );
    let localizacaoDosBarcosNaDB = JSON.parse(gameInfo.boat_location);

    tabuleiro_na_db["jogador"+playerNumber].tabuleiro = tabuleiro;
    localizacaoDosBarcosNaDB["jogador"+playerNumber] = meusBarcos;
    //Atualizar o estado do jogo
    let editGameInfoQuery = db.prepare("UPDATE games SET gameInfo = ?, boat_location=? WHERE id = ?;")
    .run(JSON.stringify(tabuleiro_na_db), JSON.stringify(localizacaoDosBarcosNaDB), gameID);
    
    
    //Diz ao jogador que o inimigo está pronto
    if(gameInfo.player1 === player)
        io.emit('InGame_'+gameInfo.player2,'EnemyReady');
    else
        io.emit('InGame_'+gameInfo.player1,'EnemyReady');

    res.header(200).end(JSON.stringify({ code: true}));

});

app.post('/api/game/getLayout', (req,res) => {
    //Nome do jogador
    let player = req.session.username;
    //ID do jogo
    let gameID = req.body.gameID;

    if(!temSessaoIniciada(req)){
        res.header(401).end(JSON.stringify({ code: false, username: ''}));
        return;
    }

    console.log("[POST] /api/game/getLayout by "+player);


    let query = db.prepare("SELECT COUNT(*) AS numero FROM games WHERE terminado = '0' AND player1 = ? OR player2 = ?").get(player,player);
    if(query.numero <= 0){
        res.header(200).end(JSON.stringify({ code: false}));
        return;
    }

    //Informação daquele jogo
    let gameInfo = db.prepare("SELECT * FROM games WHERE terminado = '0' AND id = ?;").get(gameID);
    let tabuleiro_na_db = JSON.parse( gameInfo.gameInfo );
    //radar1-> Radar do jogador1; radar2-> radar do jogador 2
    if(gameInfo.player1 === player)
        res.header(200).end(JSON.stringify({ 
            code: true, 
            tabuleiro: tabuleiro_na_db.jogador1.tabuleiro, 
            radar1: tabuleiro_na_db.jogador1.radar, 
            radar2: tabuleiro_na_db.jogador2.radar,
            aJogar: tabuleiro_na_db.aJogar,
            boat_location: JSON.stringify(JSON.parse(gameInfo.boat_location).jogador2)
        }));
    else
        res.header(200).end(JSON.stringify({ 
            code: true, 
            tabuleiro: tabuleiro_na_db.jogador2.tabuleiro, 
            radar1: tabuleiro_na_db.jogador1.radar, 
            radar2: tabuleiro_na_db.jogador2.radar,
            aJogar: tabuleiro_na_db.aJogar,
            boat_location: JSON.stringify(JSON.parse(gameInfo.boat_location).jogador1)
        }));
});

const jaTerminouOJogo = (gameID) => {
    console.log("Executado jaTerminouOJogo()");

    let jogador1 = {
        tabuleiro: '',
        radar: ''
    };
    let jogador2 = {
        tabuleiro: '',
        radar: ''
    };
    let gameInfo = JSON.parse(db.prepare("SELECT gameInfo FROM games WHERE terminado = '0' AND id= ?").get(gameID).gameInfo);
    jogador1.tabuleiro = JSON.parse(gameInfo.jogador1.tabuleiro);
    jogador1.radar = gameInfo.jogador1.radar;
    jogador2.tabuleiro = JSON.parse(gameInfo.jogador2.tabuleiro);
    jogador2.radar = gameInfo.jogador2.radar;
    //Resultado se o jogador 1 ganhou
    let jogador1Ganhou = true;
    let jogador2Ganhou = true;
    for(let i = 1; i <= 9; i++)
        for(let p = 65; p <=75;p++)
        {
            let letra = String.fromCharCode(p);
            if(jogador2.tabuleiro[i][letra] === "1" && jogador1.radar[i][letra] === 0){
                ///console.log("["+jogador2.tabuleiro[i][letra]+"]["+jogador1.radar[i][letra]+
                ///"Jogador1 ainda não acertou na posicao "+i+""+letra);
                jogador1Ganhou = false;
            }else
            if(jogador1.tabuleiro[i][letra] === "1" && jogador2.radar[i][letra] === 0){
                ///console.log("["+jogador2.tabuleiro[i][letra]+"]["+jogador1.radar[i][letra]+
                ///"Jogador2 ainda não acertou na posicao "+i+""+letra);
                jogador2Ganhou = false;
            }
        }
    console.log("(jaTerminouOJogo) Jogador 1 ganhou: "+jogador1Ganhou);
    console.log("(jaTerminouOJogo) Jogador 2 ganhou: "+jogador2Ganhou);
    return {jogador1Ganhou: jogador1Ganhou, jogador2Ganhou: jogador2Ganhou};
}

//Verificar e marcar que o jogo já terminou
app.post('/api/game/updateEstadoDoJogo', (req,res) => {
    //ID do jogo
    let gameID = req.body.gameID;
    console.log("[s]: "+gameID);
    console.log("[POST] /api/game/updateEstadoDoJogo by "+req.session.username);
    
    
    //#region Verificar se o jogo já terminou
    let query = db.prepare("SELECT COUNT(*) AS numero FROM games WHERE terminado = '1' AND id= ?").get(gameID);
    if(query.numero > 0){
        res.header(200).end(JSON.stringify({ code: false}));
        return;
    }
    //#endregion

    let resp = jaTerminouOJogo(gameID);
    if(resp.jogador1Ganhou || resp.jogador2Ganhou)
    {
        let query = db.prepare("UPDATE games SET terminado = '1' WHERE id = ?;").run(gameID);
    }
    res.header(200).end(JSON.stringify({ 
        code: true,
        jogador1Ganhou: resp.jogador1Ganhou,
        jogador2Ganhou: resp.jogador2Ganhou
    }));
});


app.post('/api/game/hasGameEnded', (req,res) => {
    //ID do jogo
    let gameID = req.body.gameID;

    console.log("[POST] /api/game/hasGameEnded by "+req.session.username);
    
    
    //#region Verificar se o jogo já terminou
    let query = db.prepare("SELECT COUNT(*) AS numero FROM games WHERE terminado = '1' AND id= ?").get(gameID);
    if(query.numero > 0){
        res.header(200).end(JSON.stringify({ code: false}));
        return;
    }
    //#endregion

    let resp = jaTerminouOJogo(gameID);
    res.header(200).end(JSON.stringify({ 
        code: true,
        jogador1Ganhou: resp.jogador1Ganhou,
        jogador2Ganhou: resp.jogador2Ganhou
    }));
});

/*
//Formato do JSON guardado na base de dados do estado atual do jogo
{
    jogador1: {
        tabuleiro: [TABULEIRO AQUI],
        //O radar é o tabuleiro onde fica marcado os tiros que atiramos.
        //0-> ainda não atirado; 1-> tiro sem acertar; 2-> tiro certeiro
        radar: [RADAR AQUI]
    },
    jogador2: {
        tabuleiro: [TABULEIRO AQUI],
        //O radar é o tabuleiro onde fica marcado os tiros que atiramos.
        //0-> ainda não atirado; 1-> tiro sem acertar; 2-> tiro certeiro
        radar: [RADAR AQUI]
    },
    aJogar: [NUMERO_DO_PLAYER_A_JOGAR_AGORA]
}
*/

//SocketIO
io.on('connection',(socket) => {
    let player = socket.handshake.session.username;
    if(player != undefined){
        socket.on('joinGame', (gameID) => {
            console.log("[SOCKET] joinGame by "+player);

            let query = db.prepare("UPDATE games SET player2 = ? WHERE id = ?;").run(player,gameID);
            console.log(`O utilizador ${player} juntou-se ao jogo ${gameID}!`);
            io.emit('Joined Session');
        });

        socket.on('Game', (data) => {
            console.log("[Game] Game by "+player);

            let recebido = JSON.parse(data);
            let gameID = recebido.gameID;
            //Se é o 1 ou o 2
            let tipoDeJogador = recebido.jogador;
            let tipoDeJogadorInimigo = (tipoDeJogador === 1)? 2:1;

            
            //Informação daquele jogo
            let gameInfo = db.prepare('SELECT * FROM games WHERE id = ?;').get(gameID);
            let tabuleiro_na_db = JSON.parse( gameInfo.gameInfo );
            switch(recebido.estado)
            {
                case "info":
                    
                    console.log("[Game] Game info by "+player);
                    io.emit('Game_'+gameID,
                    JSON.stringify({
                        //1-> Terminou; 0-> Não terminou
                        terminado: gameInfo.terminado, 
                        //Quem é a jogar
                        aJogar: tabuleiro_na_db.aJogar
                    }));
                    break;
                case "play":
                    console.log("[Game] Game play by "+player);
                    let jogada = recebido.jogada;
                    //Obrigar a copia de valores e nao de apontadores no JavaScript
                    let novo_tabuleiro = JSON.parse(JSON.stringify(tabuleiro_na_db));
                    let o_meu_radar = novo_tabuleiro["jogador"+tipoDeJogador].radar;
                    let tabuleiroDoInimigo = JSON.parse(tabuleiro_na_db["jogador"+tipoDeJogadorInimigo].tabuleiro);
                    let x = jogada[0];
                    let y = jogada[1];
                    console.log('['+tipoDeJogador+'] Jogado: '+x+y);
                    let quadradoInimigo = parseInt(tabuleiroDoInimigo[x][y]);
                    let tiroCerteiro = false;
                    if(quadradoInimigo === 1){
                        o_meu_radar[x][y] = 2;
                        tiroCerteiro = true;
                    }else
                        o_meu_radar[x][y] = 1;

                    novo_tabuleiro.aJogar = tipoDeJogadorInimigo;
                    let editGameInfoQuery = db.prepare("UPDATE games SET gameInfo = ? WHERE id = ?;")
                        .run(JSON.stringify(novo_tabuleiro), gameID);
                    
                    //ver se o jogo já terminou com nova query a db
                    let alguemGanhou = jaTerminouOJogo(gameID);
                    let jogoTerminado = (alguemGanhou.jogador1Ganhou === true || alguemGanhou.jogador2Ganhou === true)? true:false;

                    io.emit('Game_'+gameID,JSON.stringify({
                        terminado: jogoTerminado, 
                        aJogar: novo_tabuleiro.aJogar,
                        quemJogou: tipoDeJogador,
                        jogada: jogada,
                        tiroCerteito: tiroCerteiro
                    }));
                    

                    //VERIFICAR SE E UM TIRO CERTEIRO
                    //ESCREVER NO MEU RADAR O MEU TIRO E SALVAR NA DB
                    //PASSAR A VEZ AO INIMIGO



                    /*
                    novo_tabuleiro.aJogar = tipoDeJogadorInimigo;

                    
                    let tiroCerteiro = false;
                    let meuRadar = novo_tabuleiro["jogador"+tipoDeJogador].radar;
                    let tabuleiroDoInimigo = JSON.parse(novo_tabuleiro["jogador"+tipoDeJogadorInimigo].tabuleiro);
                    console.log("IF laDO INIMIGO: "+parseInt(tabuleiroDoInimigo[x][y]));
                    console.log("ID LADO DO MEU RADAR: "+meuRadar[x][y]);
                    if( parseInt(tabuleiroDoInimigo[x][y]) === 1){
                        tiroCerteiro = true;
                        novo_tabuleiro["jogador"+novo_tabuleiro.aJogar].radar[x][y] = 2;
                    }else
                        novo_tabuleiro["jogador"+novo_tabuleiro.aJogar].radar[x][y] = 1;

                    let editGameInfoQuery = db.prepare("UPDATE games SET gameInfo = ? WHERE id = ?;")
                    .run(JSON.stringify(novo_tabuleiro), gameID);
                    
                    console.log("Inimigo: "+tipoDeJogadorInimigo);

                    console.log("Tabuleiro: "+tabuleiroDoInimigo[x][y]);

                    console.log("Radar: "+meuRadar[x][y]);



                    io.emit('Game_'+gameID,JSON.stringify({
                        terminado: gameInfo.terminado, 
                        aJogar: novo_tabuleiro.aJogar,
                        quemJogou: tipoDeJogador,
                        jogada: jogada,
                        tiroCerteito: tiroCerteiro
                    }));*/
                    break;

            }
        });


    }

});




server.listen(configuracao.porta, () => {
    console.log(`Servidor iniciado na porta ${configuracao.porta}`);
});

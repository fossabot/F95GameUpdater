/*### Generic events ###*/
document.addEventListener("DOMContentLoaded", function () {
  // This function runs when the DOM is ready, i.e. when the document has been parsed

  // Initialize the tabNavigator
  var tabNavigator = document.getElementById("tabNavigator");
  M.Tabs.init(tabNavigator, {});

  // Get the element with id="defaultOpen" and click on it
  document.getElementById("defaultOpenTab").click();

  // Load the cached games
  loadCachedGames();

  // Login to F95Zone
  login();
});

/*### Text changed events ###*/
document.querySelector('#searchGameName').addEventListener('input', () => {
  // Obtain the text
  var searchText = document.getElementById("searchGameName").value.toUpperCase();

  // Obtain all the available GameCard
  var gameCards = document.querySelectorAll('game-card');

  // Hide the column which the cardgame belong 
  // if it's games with a title that not match the search query
  for (var i = 0; i < gameCards.length; i++) {
    var gameName = gameCards[i].info.name.toUpperCase();
    if (!gameName.startsWith(searchText)) {
      gameCards[i].parentNode.style.display = "none";
    } else {
      gameCards[i].parentNode.style.display = "block";
    }
  }
})

/*### Click events ###*/
document.querySelector('#btnLogin').addEventListener('click', () => {
  login();
})

document.querySelector('#btnAddGame').addEventListener('click', () => {
  const options = {
    title: 'Select game directory',
    properties: ['openDirectory']
  }
  window.dialog.showOpenDialog(null, options)
    .then((data) => {
      if (data.filePaths.length === 0) return;

      // Parse the game dir name
      const path = data.filePaths[0];
      var name = path.split('\\').pop();
      name = removeSpecials(name, ['-', '[', ']', '.', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

      const MOD_VERSION = '[MOD]';
      var includeMods = name.toUpperCase().includes(MOD_VERSION) ? true : false;

      var version = 'Unknown';
      const PREFIX_VERSION = '[V.'; // i.e. namegame [v.1.2.3.4]
      if (name.toUpperCase().includes(PREFIX_VERSION)) {
        var startIndex = name.toUpperCase().indexOf(PREFIX_VERSION) + PREFIX_VERSION.length;
        var endIndex = name.indexOf(']', startIndex);
        version = name.substr(startIndex, endIndex - startIndex);
      }

      // Clean name (remove mod tag and version)
      var rx = /\[(.*?)\]/g;
      name = name.replaceAll(rx, '').trim();

      // Search and add the game
      window.gameScraper
        .getGameData(name, includeMods)
        .then((result) => {

          if (result === null) return;
          // Add the game
          var card = addGameCard();
          result.gameDir = path;
          card.info = result;

          // Set the local game version and trigger version check
          if (result.version !== version) card.checkUpdates();
        });
    });
})

/*### Private methods ###*/
function openPage(pageName) {
  // Local variables
  var i, tabcontent;

  // Hide all elements with class="tabcontent" by default
  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }

  // Show the specific tab content
  document.getElementById(pageName).style.display = "block";
}

function createNewGridRowInDOM() {
  // Create a new div 'row'
  var row = document.createElement('div');
  row.setAttribute('class', 'row');

  // Select the container div
  var container = document.getElementById('gamesTab');

  // Add the row to the div
  container.appendChild(row);

  return row;
}

function addGameCard() {
  // Create a GameCard. The HTML is loaded when the custom element is connected to DOM, so:
  // 1 - First we create the element
  // 2 - When connect the element to DOM
  // 3 - Lastly. we can change the 'gamedata' property
  var gameCard = document.createElement('game-card');

  // Create a simil-table layout wit materialize-css
  // 's4' means that the element occupies 4 of 12 columns
  // The 12 columns are the base layout provided by materialize-css
  var column = document.createElement('div');
  column.setAttribute('class', 'col s4');
  column.appendChild(gameCard);

  // Check if is needed to create a new 'row' in the grid
  var cardGamesNumber = document.querySelectorAll('game-card').length;
  var rowsInDOM = document.querySelectorAll('#gamesTab > div.row');
  const gamesPerRow = 3; // s4 -> 12 / 4 = 3
  var row;
  if (rowsInDOM.length == 0) {
    // We need a new row!
    row = createNewGridRowInDOM();
  } else if (cardGamesNumber % gamesPerRow == 0) {
    // We need a new row!
    row = createNewGridRowInDOM();
  } else {
    // Select the last row
    row = rowsInDOM[rowsInDOM.length - 1];
  }

  // Connect the new column to the pre-existend/new row in DOM
  row.appendChild(column);

  return gameCard;
}

function removeSpecials(str, allowedChars) {
  var lower = str.toLowerCase();
  var upper = str.toUpperCase();

  var res = "";
  for (var i = 0; i < lower.length; ++i) {
    if (lower[i] != upper[i] || lower[i].trim() === '' || allowedChars.includes(lower[i]))
      res += str[i];
  }
  return res;
}

function loadCachedGames() {
  console.log('Load cached games...');

  var files = window.glob.sync('*.json', {
    cwd: window.AppCostant.GAME_DATA_DIR
  });

  for (const filename of files) {
    var card = addGameCard();
    card.datapath = window.join(window.AppCostant.GAME_DATA_DIR, filename);
  }

  console.log('Loading completed');
}

function login() {
  // Check network connection
  if (!window.isOnline()) {
    const options = {
      type: 'warning',
      buttons: ['OK'],
      defaultId: 0,
      title: 'Nessuna connessione',
      message: 'Nessuna connessione alla rete rilevata, impossibile eseguire il login a F95Zone',
      detail: "La mancanza di connessione impedisce il login e l'aggiornamento dei giochi ma ti permette comunque di giocarci",
    };

    window.dialog.showMessageBox(this, options);
    console.warn('No network connection, cannot login');
    return;
  }

  // Request user input
  console.log('Send ipc to main process for auth request')
  window.ipc.send('login-required');
}

// Called when the window is being closed
window.ipc.on('app-close', _ => {

  // Remove all the GameCards to allow saving data
  var cardGames = document.querySelectorAll('game-card');
  for (var card of cardGames) {
    // Remove the <div> containing the card
    card.parentNode.removeChild(card);
  }

  // Tell the main process to close this BrowserWindow
  window.ipc.send('closed');
});

// Called when the user log in to F95Zone correctly
window.ipc.on('auth-successful', (event, json) => {
  // Load data
  var credentials = JSON.parse(json);
  window.gameScraper.login(credentials['username'], credentials['password'])
    .then(
      window.gameScraper.loadF95BaseData()
      .then(function () {
        // Show 'add game' button
        document.getElementById('btnAddGame').style.display = 'block';

        // Hide 'login' button
        document.getElementById('btnLogin').style.display = 'none';

        // Check update for all the listed games
        var cardGames = document.querySelectorAll('game-card');
        for (var card of cardGames) {
          card.checkUpdates();
        }
      }));
});
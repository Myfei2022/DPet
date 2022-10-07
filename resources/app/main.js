const {app, globalShortcut, BrowserWindow, Menu, Tray, ipcMain, screen} = require('electron');

//主窗口
let mainWindow = null;
//托盘
let tray;
let devToolsIsOpen = false;
//主窗口大小
let mainSize;

//参数err表示发生的异常
process.on("uncaughtException", function (err) {
    alert("Uncaught error, closing...\n" + err);
    app.exit();
});

app.on('ready', () => {

    // 解决透明窗口打开闪烁问题
    app.commandLine.appendSwitch('wm-window-animations-disabled');

    //创建窗口
    createWindow();

    //注册快捷键
    // registerShortCut();

    //创建托盘
    createTray();

    //加载页面
    mainWindow.loadFile('index.html');

    //退出
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
});

function createWindow() {

    //获取显示器大小
    mainSize = {};

    //创建主窗口
    mainWindow = new BrowserWindow({
            frame: false,
            transparent: true,
            skipTaskbar: true,
            alwaysOnTop: true,
            webPreferences: {
                nodeIntegration: true,
                enableRemoteModule: true,
                contextIsolation: false
            }
        }
    );

    //设置位置
    mainWindow.setPosition(0, 0);

    //根据显示器刷新窗口大小
    ipcMain.on('mainWindowResize', (event, width, height) => {
        mainSize.width = width;
        mainSize.height = height;
        mainWindow.setSize(width, height);
    })
}

function registerShortCut() {
    //注册快捷键
    const ret = globalShortcut.register('CmdOrCtrl+T', () => {
        devToolsIsOpen ? mainWindow.webContents.closeDevTools() : mainWindow.webContents.openDevTools();
        devToolsIsOpen = !devToolsIsOpen;
    });
    globalShortcut.register('CmdOrCtrl+Q', () => {
        app.exit();
    })
    // 检查快捷键是否注册成功
    if (!ret) {
        console.log('registration failed');
    }

    // 注销快捷键
    app.on('will-quit', () => {
        // 注销快捷键
        globalShortcut.unregister('CmdOrCtrl+D');

        // 注销所有快捷键
        globalShortcut.unregisterAll();
    })

}

function createTray() {

    //创建托盘
    tray = new Tray('favicon.ico');

    //托盘模板
    let trayContextMenu = Menu.buildFromTemplate([
        {label: '退出', role: 'quit'},
    ]);

    //设置托盘
    tray.setToolTip('©2020MMMIU');
    tray.setContextMenu(trayContextMenu);
}

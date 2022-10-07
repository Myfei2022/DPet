const {remote, ipcRenderer} = require('electron');
const BrowserWindow = require('electron').remote.BrowserWindow
const fs = require("fs");
const NodeID3 = require('node-id3')
let devMode = false;
let pauseAnime = false;
let screenWidth, screenHeight;
let contextMenu, playerContextMenu;
let gravity = 20;
let wallCollisionLoss = 0.85;
//Minimum fresh rate
let freshRate = 165;
let dragDetectTime = 300;
let minImgSizeX, minImgSizeY;
let imgSizeX, imgSizeY;
let imgPositionX, imgPositionY;
/*
    timer[0]系统保留计时器
    timer[1]每个状态中的顺序计时器
    timer[2]针对timer[1]的计时器，用于控制状态
    timer[3]动画自动化
*/
let timer = [];
let offsetMouseToImg, speedX = 0, speedY = 0;
let minQuietTime = 3, maxQuietTime = 5;
let img, imgStyle, imgIndex;
let facingLeft = true;
let state;
let anime;
let animations = ['default', 'walking', 'sittingAndShake', 'crawling', 'lookingAtMouse', 'sittingQuietly'];
let musicPlayerOn = false;
let playerRealDrag = false;
let musicArray, musicArrayPlayList, deletedArray = new Array();
let audio;
let musicIndex = 0;
let playMode = 0;
let arrayRefreshTimer, playControlTimer, progressTimer, titleRollTimer, tmpTitleBarTimer, volumeBarTimer;
let playListOn = false, volumeBarOn = false;
let musicPlayer;
let volume = 0.5, tmpVolume = 0;


window.onload = () => {

    img = document.getElementById('img');
    musicPlayer = document.getElementById('musicPlayer');
    audio = document.getElementById('audio');

    imgStyle = img.style;

    //获取并设置窗口大小
    setWindowSize();

    //右键菜单
    createContextMenu();

    //展示默认图片
    imgStyle.width = imgSizeX + 'px';
    imgStyle.height = imgSizeY + 'px';
    imgStyle.position = "absolute";
    imgStyle.backgroundImage = "url('img/shime" + 1 + ".png')";
    imgStyle.backgroundRepeat = "no-repeat";
    imgStyle.backgroundPosition = "center";
    imgStyle.backgroundSize = "cover";
    imgStyle.left = '77%';
    imgStyle.top = '0px';
    // imgStyle.backgroundColor = 'aqua'
    imgIndex = 1;

    setMouseThrough();

    //设置拖动事件
    setDrag();

    //start!
    falling(0, 0);
    // setMusicPlayer();
}

//状态机……？
function setState(arg) {

    //清空可能的事件
    clearAllUserTimers();
    anime = null;
    img.onmouseup = null;
    // document.onmousemove = null;

    state = arg;
    switch (arg) {
        case 'default':
            anime = setDefault();
            break;
        case 'walking':
            anime = walking();
            break;
        case 'crawling':
            anime = crawling();
            break;
        case 'crawlingTop':
            anime = crawlingTop();
            break;
        case 'climbing':
            anime = climbing();
            break;
        case 'lookingAtMouse':
            anime = lookingAtMouse();
            break;
        case 'sittingAndShake':
            anime = sittingAndShake();
            break;
        case 'sittingQuietly':
            anime = sittingQuietly();
            break;
        default:
            anime = setDefault();
    }
    pauseSwitch(pauseAnime);
}

//右键菜单
function createContextMenu() {
    let template = [
        {
            label: '咋瓦鲁多（暂停切换）', id: 'theWorld', type: 'checkbox', click: function () {
                pauseSwitch(!pauseAnime);
            }
        },
        {
            label: '设定动作（如果可用）', submenu: [
                {
                    label: "罚站", click: function () {
                        if (oneAmongTheAnimations(state)) {
                            setState('default');
                            pauseSwitch(true);
                        }
                    }
                },
                {
                    label: "走两步", click: function () {
                        if (oneAmongTheAnimations(state)) {
                            pauseSwitch(false);
                            setState('walking');
                        }
                    }
                },
                {
                    label: "爪巴", click: function () {
                        if (oneAmongTheAnimations(state)) {
                            pauseSwitch(false);
                            setState('crawling');
                        }
                    }
                },
                {
                    label: "坐下", submenu: [
                        {
                            label: "晃腿", click: function () {
                                if (oneAmongTheAnimations(state)) {
                                    setState('sittingAndShake');
                                    pauseSwitch(true);
                                }
                            }
                        },
                        {
                            label: "看鼠标", click: function () {
                                if (oneAmongTheAnimations(state)) {
                                    setState('lookingAtMouse');
                                    pauseSwitch(true);
                                }
                            }
                        },
                        {
                            label: "不做啥", click: function () {
                                if (oneAmongTheAnimations(state)) {
                                    setState('sittingQuietly');
                                    pauseSwitch(true);
                                }
                            }
                        }
                    ]
                },

            ]
        },
        {
            label: '来一首!', id: 'playMusic', click: function () {
                if (!musicPlayerOn) {
                    setMusicPlayer();
                    musicPlayerOn = true;
                }
            }
        },
        {type: 'separator'},
        {label: '退出', role: 'quit'}
    ];


    //播放器右键
    let playerTemplate = [
        {
            label: '关闭播放器', click: function () {
                closeMusicPlayer();
            }
        },
        {label: '退出', role: 'quit'}
    ];

    function oneAmongTheAnimations(state) {
        for (let i = 0; i < animations.length; i++) {
            if (animations[i] === state)//如果要求数据类型也一致，这里可使用恒等号===
                return true;
        }
        return false;
    }

    contextMenu = remote.Menu.buildFromTemplate(template);
    contextMenu.on('menu-will-close', () => {
        if (!pauseAnime && anime != null) {
            anime.resume();
        }
    })
    img.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        contextMenu.popup({window: remote.getCurrentWindow()});
    });


    playerContextMenu = remote.Menu.buildFromTemplate(playerTemplate);
    playerContextMenu.on('menu-will-close', () => {

    })
    musicPlayer.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        playerContextMenu.popup({window: remote.getCurrentWindow()});
    });
}

function pauseSwitch(option) {
    if (pauseAnime === option) return;
    pauseAnime = option;
    if (anime != null) {
        if (pauseAnime) {
            anime.pause();
        } else {
            anime.resume();
        }
    }
    contextMenu.getMenuItemById('theWorld').checked = pauseAnime;
}

function setDefault() {
    let randomQuietTime = Math.floor(Math.random() * (maxQuietTime - minQuietTime + 1)) + minQuietTime;
    let nextState = animations[Math.floor(Math.random() * animations.length)];
    if (imgPositionY + imgSizeY < screenHeight) {
        falling(0, 0);
    } else {
        setFacingLeft(true, true);
        speedX = speedY = 0;
        setImage(1);
        timer[3] = setTimeout(() => {
            if (state === 'default') {
                setState(nextState);
            }
        }, randomQuietTime * 1000);
    }

    img.onmouseup = function (e) {
        if (e.button === 2) {
            pause();
        }
    }

    function pause() {
        clearTimer(3);
    }

    function resume() {
        timer[3] = setTimeout(() => {
            if (state === 'default') {
                setState(nextState);
            }
        }, randomQuietTime * 1000);
    }

    return {
        pause,
        resume
    }
}

// drag拖移事件
function setDrag() {

    let initialized = false;

    img.onmousedown = function (e) {
        if (e.button === 2) return;
        let realDrag = false;
        //基础设置
        initialized = false;
        speedX = speedY = 0;
        offsetMouseToImg = [e.offsetX, e.offsetY];
        let clickPosition = [e.clientX, e.clientY];

        document.onmousemove = function (e) {
            if (!realDrag) {
                if (Math.abs(e.clientX - clickPosition[0]) > 5 || Math.abs(e.clientY - clickPosition[1]) > 5) {
                    realDrag = true;
                } else {
                    return;
                }
            }
            if (!offsetMouseToImg) return;
            if (!initialized) {
                initialized = true;
                //清空可能的事件
                clearAllUserTimers();
                img.onmouseup = null;
                let possibleImgArray = [1, 5, 6, 7, 8, 9, 10];
                let imgArray = false;
                for (let i = 0; i < possibleImgArray.length; i++) {
                    if (possibleImgArray[i] === imgIndex)
                        imgArray = true;
                }
                if (!imgArray) {
                    setImage(1);
                }
                setFacingLeft(true, true);
            }
            //鼠标速度
            speedX = e.movementX;
            speedY = e.movementY;


            if (speedX > 0) {
                if (!facingLeft) {
                    setFacingLeft(true, false);
                    clearTimer(1);
                    dragged();
                    timer[1] = setInterval(dragged, dragDetectTime);
                }
            } else {
                if (facingLeft) {
                    setFacingLeft(false, false);
                    clearTimer(1);
                    dragged();
                    timer[1] = setInterval(dragged, dragDetectTime);
                }
            }

            //根据速度设置图片
            function dragged() {
                let speed = speedX * speedX;
                if (speed < 5) {
                    setImage(1);
                } else if (speed < 16) {
                    if (facingLeft) {
                        setImage(5)
                    } else {
                        setImage(6);
                    }
                } else if (speed < 64) {
                    if (facingLeft) {
                        setImage(7)
                    } else {
                        setImage(8);
                    }
                } else {
                    if (facingLeft) {
                        setImage(9)
                    } else {
                        setImage(10);
                    }
                }

            }

            //img位置
            imgPositionX = e.clientX - offsetMouseToImg[0];
            imgPositionY = e.clientY - offsetMouseToImg[1];
            //判断右侧边界
            if (imgPositionX + imgSizeX >= screenWidth) {
                imgPositionX = screenWidth - imgSizeX;
            }
            //判断左侧边界
            if (imgPositionX <= 0) {
                imgPositionX = 0;
            }
            //判断顶部
            if (imgPositionY <= 0) {
                imgPositionY = 0;
            }
            //判断底部
            if (imgPositionY + imgSizeY >= screenHeight) {
                imgPositionY = screenHeight - imgSizeY;
            }
            imgStyle.left = imgPositionX + 'px';
            imgStyle.top = imgPositionY + 'px';
        };

        document.onmouseup = function (e) {
            document.onmousemove = null;
            if (e.button === 2) return;
            offsetMouseToImg = null;
            if ((imgPositionX <= 0 || imgPositionX + imgSizeX >= screenWidth) && imgPositionY >= 0) {
                setState('climbing');
            } else if (imgPositionY + imgSizeY < screenHeight) {
                falling(speedX, speedY);
            } else {
                if (pauseAnime) {
                    setState(state);
                }
            }
        };
    }
}

//下落
function falling(speedX, speedY) {

    clearAllUserTimers()
    let timeCount = 0;
    let freshTime = Math.floor(1000 / freshRate);
    setImage(4);

    //获取当前位置
    [imgPositionX, imgPositionY] = [img.offsetLeft, img.offsetTop];
    if (imgPositionX < 0) imgPositionX = 0;
    if (imgPositionY < 0) imgPositionY = 0;
    imgPositionX = imgPositionX + imgSizeX >= screenWidth ? screenWidth - imgSizeX : imgPositionX;
    imgPositionY = imgPositionY + imgSizeY >= screenHeight ? screenHeight - imgSizeY : imgPositionY;

    imgStyle.left = Math.round(imgPositionX) + 'px';
    imgStyle.top = Math.round(imgPositionY) + 'px';

    timer[1] = setInterval(() => {

        //如果到达底部退出循环
        if (imgPositionY + imgSizeY < screenHeight) {

            //判断是否在顶部
            if (imgPositionY <= 0) {
                speedY = -speedY * (1 - wallCollisionLoss) + 1;
            }

            //判断左右边界
            if ((imgPositionX <= 0 || imgPositionX + imgSizeX >= screenWidth) && imgPositionY >= 0) {
                if (speedX < 16) {
                    setState('climbing');
                    return;
                } else {
                    speedX = -speedX * (1 - wallCollisionLoss);
                }
            }

            //下落速度计算
            speedY += gravity * freshTime / 1000;

            //设置位置
            if (imgPositionX < 0) imgPositionX = 0;
            if (imgPositionY < 0) imgPositionY = 0;
            imgPositionX = imgPositionX + imgSizeX + speedX >= screenWidth ? screenWidth - imgSizeX : imgPositionX + speedX;
            imgPositionY = imgPositionY + imgSizeY + speedY >= screenHeight ? screenHeight - imgSizeY : imgPositionY + speedY;

            imgStyle.left = Math.round(imgPositionX) + 'px';
            imgStyle.top = Math.round(imgPositionY) + 'px';

            timeCount++;
        } else {
            clearTimer(1);
            //落地过渡动画
            setImage(18);
            //回归正常模式
            timer[1] = setTimeout(() => {
                if (pauseAnime) {
                    setState(state);
                } else {
                    setState('default');
                }
            }, 200)
        }
    }, freshTime);

}

//水平移动
function walking() {
    let moveChangeImage = 37;
    let moveLength = -1, minMoveLength = 100;
    let chanceMoveToEdge = 0.2;
    let imgSet = [2, 3]
    let movingSpeed = 1;

    let move = movingH(moveChangeImage, moveLength, minMoveLength, chanceMoveToEdge, imgSet, movingSpeed);

    img.onmouseup = function (e) {
        if (e.button === 2) {
            pause();
        }
    }

    function pause() {
        move.pause();
        setImage(1);
    }

    function resume() {
        move.resume();
    }

    return {
        pause,
        resume
    }
}

//底部爬行
function crawling() {
    let moveChangeImage = 10;
    let moveLength = -1, minMoveLength = 100;
    let chanceMoveToEdge = 0.2;
    let imgSet = [20, 21];
    let movingSpeed = 0.1;

    let move = movingH(moveChangeImage, moveLength, minMoveLength, chanceMoveToEdge, imgSet, movingSpeed);

    img.onmouseup = function (e) {
        if (e.button === 2) {
            pause();
        }
    }

    function pause() {
        move.pause();
        setImage(18);
    }

    function resume() {
        move.resume();
    }

    return {
        pause,
        resume
    }

}

//顶部爬行
function crawlingTop() {
    let moveChangeImage = 10;
    let moveLength = -1, minMoveLength = 100;
    let chanceMoveToEdge = 0;
    let imgSet = [24, 25];
    let movingSpeed = 0.1;

    //设定位置
    imgPositionY = -imgSizeY / 2 + 20;
    imgStyle.top = imgPositionY + 'px';

    if (imgPositionX < 0) imgPositionX = 0;
    imgPositionX = imgPositionX + imgSizeX >= screenWidth ? screenWidth - imgSizeX : imgPositionX;
    imgStyle.left = Math.round(imgPositionX) + 'px';
    setImage(23)

    let move = movingH(moveChangeImage, moveLength, minMoveLength, chanceMoveToEdge, imgSet, movingSpeed);

    img.onmouseup = function (e) {
        if (e.button === 2) {
            pause();
        }
    }

    function pause() {
        move.pause();
        setImage(23);
    }

    function resume() {
        move.resume();
    }

    return {
        pause,
        resume
    }
}

//坐下并晃腿
function sittingAndShake() {

    let chanceShakeLeg = 0.2;
    let defaultChance = 0.2;
    let chanceWantToStand = 0.2;
    let minQuietTime = 3, maxQuietTime = 10, minShakeTime = 3;
    setFacingLeft(true, true);
    //坐下过渡动画
    setImage(30);
    timer[1] = setTimeout(() => {
        setImage(31);
    }, 3000)

    //设置抖腿前时间
    let quietTime = Math.random() * (maxQuietTime - minQuietTime + 1) + minQuietTime;
    timer[1] = setTimeout(shakeLeg, quietTime * 1000);

    //抖起来
    function shakeLeg() {

        if (Math.random() < chanceShakeLeg) {
            timer[1] = setInterval(() => {
                if (imgIndex === 32) {
                    setImage(33);
                } else {
                    setImage(32);
                }
            }, 200);
        }

        //设定抖腿时间
        let shakeTime = Math.random() * minQuietTime + minShakeTime;
        timer[2] = setTimeout(() => {
            clearTimer(1);
            setImage(31);
            //想要站起来
            if (Math.random() >= chanceWantToStand) {
                //再来一次
                quietTime = Math.random() * (maxQuietTime - minQuietTime + 1) + minQuietTime;
                timer[1] = setTimeout(shakeLeg, quietTime * 1000);
            } else {
                //站起来前等待
                quietTime = Math.random() * (maxQuietTime - minQuietTime + 1) + minQuietTime;
                //起来
                timer[1] = setTimeout(() => {
                    setImage(30);
                    clearTimer(1);
                    timer[1] = setTimeout(() => {
                        setState('default');
                    }, 1000)
                }, quietTime * 1000);
            }
        }, shakeTime * 1000);
    }

    function pause() {
        chanceWantToStand = 0;
    }

    function resume() {
        chanceWantToStand = defaultChance;
    }

    return {
        pause,
        resume
    }
}

function sittingQuietly() {

    let chanceWantToStand = 0.2;
    let defaultChance = 0.2;
    let minQuietTime = 30, maxQuietTime = 60;
    //坐下
    setImage(11);

    //设定休息时间
    let quietTime = Math.random() * (maxQuietTime - minQuietTime + 1) + minQuietTime;
    timer[1] = setTimeout(wantToStand, quietTime * 1000);

    function wantToStand() {
        clearTimer(1);
        //想要站起来
        if (Math.random() >= chanceWantToStand) {
            //再来一次
            quietTime = Math.random() * (maxQuietTime - minQuietTime + 1) + minQuietTime;
            timer[1] = setTimeout(wantToStand, quietTime * 1000);
        } else {
            //起来
            setState('default');
        }
    }

    function pause() {
        chanceWantToStand = 0;
    }

    function resume() {
        chanceWantToStand = defaultChance;
    }

    return {
        pause,
        resume
    }
}

function climbing() {

    let minQuietTime = 5, maxQuietTime = 10;
    clearAllUserTimers();
    //判断初始情况
    if (imgPositionX > 0 && imgPositionX < screenWidth - imgSizeX && imgPositionY > 0 && imgPositionY < screenHeight - imgSizeY) {
        falling(speedX, speedY);
    } else if (imgPositionY >= screenHeight - imgSizeY) {
        setState('default');
        return;
    } else {
        if (imgPositionY <= 0) {
            setState('crawlingTop');
            return;
        }
        speedX = speedY = 0;
        //设定位置
        if (imgPositionX <= 0) {
            imgPositionX = -imgSizeX / 2;
            setFacingLeft(true, true);
        } else if (imgPositionX >= screenWidth - imgSizeX) {
            imgPositionX = screenWidth - imgSizeX / 2;
            setFacingLeft(false, true);
        }
        imgStyle.left = imgPositionX + 'px';
        setImage(12)
    }

    //爬行事件
    let move;
    let quietTime = Math.floor(Math.random() * (maxQuietTime - minQuietTime + 1)) + minQuietTime;
    timer[1] = setTimeout(() => {
        move = movingV(10, -1, 300, 0.3, [13, 14], 0.15);
    }, quietTime * 1000);

    img.onmouseup = function (e) {
        if (e.button === 2) {
            pause();
        }
    }

    function pause() {
        if (move == null) {
            clearTimer(1);
        } else {
            move.pause();
            setImage(12);
        }
    }

    function resume() {
        if (move == null) {
            timer[1] = setTimeout(() => {
                move = movingV(10, -1, 300, 0.5, [13, 14], 0.15);
            }, quietTime * 1000);
        } else {
            move.resume();
        }
    }

    return {
        pause,
        resume
    }
}

//坐下并朝着鼠标看
function lookingAtMouse() {

    let defaultChance = 0.5
    let chanceWantToStand = 0.5;

    let minQuietTime = 20, maxQuietTime = 50;
    let sitTime = Math.random() * (maxQuietTime - minQuietTime + 1) + minQuietTime;
    setImage(16);

    //为啥这个onmousemove会有效……？
    setLookingAtMouseMove();

    //想要站起来
    timer[2] = setTimeout(() => {
        if (Math.random() < chanceWantToStand) {
            setState('default');
        }
    }, sitTime * 1000);

    function pause() {
        chanceWantToStand = 0;
    }

    function resume() {
        chanceWantToStand = defaultChance;
    }

    return {
        pause,
        resume
    }
}

function setLookingAtMouseMove() {
    if (state !== "lookingAtMouse") return;
    clearTimer(1);
    document.onmousemove = function (e) {
        setLookingAtMouse(e);
    }
}

function setLookingAtMouse(e) {
    if (state !== "lookingAtMouse") return;
    let specialRange = 50;
    if (e.screenX > (imgPositionX - specialRange) && e.screenX < (imgPositionX + imgSizeX) && e.screenY > (imgPositionY - imgSizeY - specialRange)) {
        timer[1] = setTimeout(() => {
            setImage(15);
        }, 200);
    } else {
        if (e.screenX < imgPositionX) {
            timer[1] = setTimeout(() => {
                setImage(16);
            }, 200);
        } else {
            timer[1] = setTimeout(() => {
                setImage(17);
            }, 200);
        }
    }
}

//水平面上走路函数
function movingH(moveChangeImage, moveLength, minMoveLength, chanceMoveToEdge, imgSet, movingSpeed) {
    let totalMove = 0;
    let initialAtEdge = false;
    let tmpImgIndex = 0;
    let freshTime = Math.floor(1000 / freshRate);
    let singleMoveCount = 0;
    let eachStep = 1 / movingSpeed;
    let chanceClimbing = 0.5;
    contextMenu.closePopup();
    clearTimer(1);

    //边缘特殊情况
    [imgPositionX, imgPositionY] = [img.offsetLeft, img.offsetTop];
    if (imgPositionX <= 0) {
        setFacingLeft(false, true);
        initialAtEdge = true;
    } else if (imgPositionX >= screenWidth - imgSizeX) {
        setFacingLeft(true, true);
        initialAtEdge = true;
    } else {
        //设置朝向
        let luckyNumber = Math.floor(Math.random() * 2);
        if (luckyNumber === 0) {
            setFacingLeft(true, true);
        } else {
            setFacingLeft(false, true);
        }
    }

    //获得行走路程,-1就由系统指定
    if (moveLength === -1) {
        if (facingLeft) {
            if (Math.random() < chanceMoveToEdge) {
                moveLength = imgPositionX;
            } else {
                if (minMoveLength > imgPositionX) {
                    moveLength = imgPositionX;
                } else {
                    moveLength = Math.floor(Math.random() * (imgPositionX - minMoveLength + 1)) + minMoveLength;
                }
            }
        } else {
            if (Math.random() < chanceMoveToEdge) {
                moveLength = screenWidth - imgPositionX - imgSizeX;
            } else {
                if (minMoveLength > screenWidth - imgPositionX - imgSizeX) {
                    moveLength = screenWidth - imgPositionX - imgSizeX;
                } else {
                    moveLength = Math.floor(Math.random() * (screenWidth - imgPositionX - imgSizeX - minMoveLength + 1)) + minMoveLength;
                }
            }
        }
    }

    setImage(imgSet[tmpImgIndex]);

    realMove();

    function realMove() {
        timer[1] = setInterval(() => {

            //如果到达两边或指定路程退出循环
            if (initialAtEdge || (imgPositionX > 0 && imgPositionX + imgSizeX < screenWidth && totalMove < moveLength)) {
                //设置位置
                if (singleMoveCount >= eachStep) {
                    initialAtEdge = false;
                    singleMoveCount = 0;
                    if (facingLeft) {
                        imgPositionX--;
                    } else {
                        imgPositionX++;
                    }
                    imgStyle.left = imgPositionX + 'px';
                    //设置图片
                    if (totalMove % moveChangeImage === 0) {
                        setImage(imgSet[++tmpImgIndex % imgSet.length]);
                    }
                    totalMove++;
                }
                singleMoveCount++;
            } else {
                if (state === 'crawling' || state === 'walking') {
                    if (imgPositionX <= 0 || imgPositionX >= screenWidth - imgSizeX) {
                        if (Math.random() < chanceClimbing) {
                            setState('climbing');
                        }
                    } else {
                        setState('default');
                    }
                } else if (state === 'crawlingTop') {
                    setFacingLeft(true, true);
                    setImage(22);
                    clearTimer(1);
                    timer[1] = setTimeout(() => {
                        setImage(19);
                        timer[1] = setTimeout(() => {
                            falling(speedX, speedY);
                        }, 200);
                    }, 200);
                }
            }
        }, freshTime);
    }

    function pause() {
        clearTimer(1);
    }

    function resume() {
        realMove();
    }

    return {
        pause,
        resume
    }

}//垂直面上走路函数
function movingV(moveChangeImage, moveLength, minMoveLength, chanceMoveToEdge, imgSet, movingSpeed) {
    let totalMove = 0;
    let tmpImgIndex = 0;
    let freshTime = Math.floor(1000 / freshRate);
    let singleMoveCount = 0;
    let eachStep = 1 / movingSpeed;
    contextMenu.closePopup();
    clearTimer(1);

    //获得行走路程,-1就由系统指定
    if (moveLength === -1) {
        if (Math.random() < chanceMoveToEdge) {
            moveLength = imgPositionY;
        } else {
            if (minMoveLength > imgPositionY) {
                moveLength = imgPositionY;
            } else {
                moveLength = Math.floor(Math.random() * (imgPositionY - minMoveLength + 1)) + minMoveLength;
            }
        }
    }

    setImage(imgSet[tmpImgIndex]);

    realMove();

    function realMove() {
        timer[1] = setInterval(() => {

            //如果到达顶部或指定路程退出循环
            if (imgPositionY > 0 && totalMove < moveLength) {
                //设置位置
                if (singleMoveCount >= eachStep) {
                    singleMoveCount = 0;
                    imgPositionY--;
                    imgStyle.top = imgPositionY + 'px';
                    //设置图片
                    if (totalMove % moveChangeImage === 0) {
                        setImage(imgSet[++tmpImgIndex % imgSet.length]);
                    }
                    totalMove++;
                }
                singleMoveCount++;
            } else {
                if (imgPositionY <= 0) {
                    clearTimer(1);
                    setState('crawlingTop');
                } else {
                    setFacingLeft(true, true);
                    if (imgPositionX <= 0) {
                        imgPositionX = 1;
                    } else {
                        imgPositionX = screenWidth - imgSizeX - 1;
                    }
                    imgStyle.left = imgPositionX + 'px';
                    setImage(22);
                    clearTimer(1);
                    timer[1] = setTimeout(() => {
                        setImage(19);
                        timer[1] = setTimeout(() => {
                            setState('falling');
                        }, 200);
                    }, 200);
                }
            }
        }, freshTime);
    }

    function pause() {
        clearTimer(1);
    }

    function resume() {
        realMove();
    }

    return {
        pause,
        resume
    }

}

//设置窗口大小
function setWindowSize() {
    screenWidth = window.screen.availWidth;
    screenHeight = window.screen.availHeight;
    ipcRenderer.send('mainWindowResize', screenWidth, screenHeight);
}

//设置图片
function setImage(index) {
    imgIndex = index;
    let imgPre = new Image();
    imgPre.src = "img/shime" + index + ".png";
    imgPre.onload = function () {
        imgStyle.backgroundImage = "url(" + imgPre.src + ")";
        setImgSize(imgPre.width < 128 ? 128 : imgPre.width, imgPre.height < 128 ? 128 : imgPre.height);
    }
}

//设置图片大小
function setImgSize(width, height) {
    imgSizeX = width < minImgSizeX ? minImgSizeX : width;
    imgSizeY = height < minImgSizeY ? minImgSizeY : height;
    imgStyle.width = imgSizeX + 'px';
    imgStyle.height = imgSizeY + 'px';
}

//清除指定计时器
function clearTimer(index) {
    clearInterval(timer[index]);
    clearTimeout(timer[index]);
}

//清除所有计时器，不包括系统保留计时器
function clearAllUserTimers() {
    for (let i = 1; i < timer.length; i++) {
        clearTimer(i);
    }
}

//设置朝向
function setFacingLeft(left, needRotate) {
    facingLeft = left;
    if (needRotate && !facingLeft) {
        img.classList.add("mirrorRotateVertical");
    } else {
        img.classList.remove("mirrorRotateVertical");
    }
}

//设置鼠标穿透
function setMouseThrough() {
    let win = remote.getCurrentWindow();
    if (!devMode) {
        win.setIgnoreMouseEvents(true, {forward: true});
        musicPlayer.addEventListener('mouseleave', () => {
            win.setIgnoreMouseEvents(true, {forward: true})
        });
        musicPlayer.addEventListener('mouseenter', () => {
            win.setIgnoreMouseEvents(false)
        });
        img.addEventListener('mouseleave', () => {
            win.setIgnoreMouseEvents(true, {forward: true})
        });
        img.addEventListener('mouseenter', () => {
            win.setIgnoreMouseEvents(false)
        });
    } else {
        win.webContents.openDevTools();
    }
}

function setMusicPlayer() {
    musicPlayer.classList.remove('noDisplay');

    //设置窗口
    setPlayerDrag();
    //设置控制面板
    let info = document.getElementById('info');
    let playInfo = document.getElementById('playInfo');
    let playControl = document.getElementById('playControl');
    info.onmouseenter = () => {
        clearTimeout(playControlTimer)
        clearTimeout(tmpTitleBarTimer)
        playInfo.style.opacity = '0';
        playControlTimer = setTimeout(() => {
            playControl.style.opacity = '1';
            playControl.style.zIndex = '9999';
        }, 200);
        showOrHideTmpTitleBar(true);
    }
    info.onmouseleave = () => {
        clearTimeout(playControlTimer)
        clearTimeout(tmpTitleBarTimer)
        playControl.style.opacity = '0';
        playControlTimer = setTimeout(() => {
            playInfo.style.opacity = '1';
            playControl.style.zIndex = '-9999';
        }, 200);
        showOrHideTmpTitleBar(false);
    }
    //设置窗口控制
    let close = document.getElementById('close');
    close.onclick = () => {
        closeMusicPlayer();
    }
    let playList = document.getElementById('playList');
    playList.onmouseleave = () => {
        if (playListOn) {
            showHidePlayList();
        }
    }
    musicPlayer.onmouseleave = () => {
        if (playListOn) {
            showHidePlayList();
        }
    }
    //初始化音乐
    initialMusic();
}

function closeMusicPlayer() {
    if (!audio.paused) {
        playPause();
    }
    musicPlayer.classList.add('noDisplay');
    musicPlayerOn=false;
}

function setPlayerDrag() {
    musicPlayer.onmousedown = function (e) {
        if (e.button === 2) return;

        let offsetMouseToPlayer = [e.clientX - musicPlayer.offsetLeft, e.clientY - musicPlayer.offsetTop];

        let clickPosition = [e.clientX, e.clientY];
        document.onmousemove = function (e) {
            setLookingAtMouse(e);
            if (!playerRealDrag) {
                if (Math.abs(e.clientX - clickPosition[0]) > 5 || Math.abs(e.clientY - clickPosition[1]) > 5) {
                    playerRealDrag = true;
                } else {
                    return;
                }
            }
            if (!offsetMouseToPlayer) return;

            //player位置
            let playerPositionX = e.clientX - offsetMouseToPlayer[0];
            let playerPositionY = e.clientY - offsetMouseToPlayer[1];
            musicPlayer.style.left = playerPositionX + 'px';
            musicPlayer.style.top = playerPositionY + 'px';
        }

        document.onmouseup = function (e) {
            playerRealDrag = false;
            document.onmousemove = null;
            setLookingAtMouseMove(e);
            offsetMouseToPlayer = null;
        };

    }
}

function showOrHideTmpTitleBar(option) {
    let tmpTitleBar = document.getElementById('tmpTitleBar');
    if (option) {
        tmpTitleBar.classList.remove('noDisplay');
        tmpTitleBar.style.height = '20px';
    } else {
        tmpTitleBar.style.height = '0px';
        tmpTitleBarTimer = setTimeout(() => {
            tmpTitleBar.classList.add('noDisplay');
        }, 200);
    }
}


//初始化列表
function initialMusic() {
    musicArray = fs.readdirSync(__dirname + '/music');
    if (!musicArray || musicArray.length === 0) {
        alert("没有可播放的音乐~！");
        closeMusicPlayer();
    }
    arrayRefreshTimer = setInterval(() => {
        let tmpArray = fs.readdirSync(__dirname + '/music');

        if (!tmpArray || tmpArray.length === 0) {
            alert("没有可播放的音乐~！");
            closeMusicPlayer();
        }
        let totallySame = true;
        if (musicArray.length === tmpArray.length) {
            for (let i = 0; i < musicArray.length; i++) {
                if (musicArray[i] !== tmpArray[i]) {
                    totallySame = false;
                    alert()
                }
            }
        } else {
            totallySame = false;
        }
        if (!totallySame) {
            musicArray = tmpArray;
            musicArrayPlayList = musicArray;
            playMode = -1;
            switchMode();
            document.getElementById('playModeBtn').style.backgroundImage = "url('img/musicControl/cycle.png')"
            switchMusic(0);
        }
    }, 3000);
    musicArrayPlayList = musicArray;
    audio.volume = volume;
    updatePlayList();
    switchMusic(musicIndex);
}

function backMusic() {
    if (playerRealDrag) {
        playerRealDrag = false;
        return;
    }
    musicIndex = (--musicIndex + musicArrayPlayList.length) % musicArrayPlayList.length;
    switchMusic(musicIndex);
}

function nextMusic() {
    if (playerRealDrag) {
        playerRealDrag = false;
        return;
    }
    musicIndex = (++musicIndex) % musicArrayPlayList.length;
    switchMusic(musicIndex);
}

function playPause() {
    if (playerRealDrag) {
        playerRealDrag = false;
        return;
    }
    let playBtn = document.getElementById("playBtn");
    let audio = document.getElementById('audio');
    if (audio.paused) {
        audio.play();
        setProgressTimer();
        playBtn.style.backgroundImage = "url('img/musicControl/pauseC.png')";
        playBtn.onmouseenter = () => {
            playBtn.style.backgroundImage = "url('img/musicControl/pauseC.png')";
        }
        playBtn.onmouseleave = () => {
            playBtn.style.backgroundImage = "url('img/musicControl/pause.png')";
        }
    } else {
        audio.pause();//停止音乐
        clearInterval(progressTimer);
        playBtn.style.backgroundImage = "url('img/musicControl/startC.png')";
        playBtn.onmouseenter = () => {
            playBtn.style.backgroundImage = "url('img/musicControl/startC.png')";
        }
        playBtn.onmouseleave = () => {
            playBtn.style.backgroundImage = "url('img/musicControl/start.png')";
        }
    }
}

function setProgressTimer() {
    //设置时长和进度条
    let currentTime = document.getElementById('currentTime');
    let duration = document.getElementById('duration');
    let progressBar = document.getElementById('progressBar');
    let progressDot = document.getElementById('progressDot');
    let draggingDot = false;
    let dotPositionX;
    audio.addEventListener("canplaythrough", function () {
        duration.innerHTML = (audio.duration / 60 < 10 ? "0" : "") + Math.floor(audio.duration / 60) + ":" + (audio.duration % 60 < 10 ? "0" : "") + Math.floor(audio.duration % 60);
        //设置进度条控制
        progressBar.onclick = (e) => {
            if (playerRealDrag) {
                playerRealDrag = false;
            } else {
                audio.currentTime = (e.clientX - musicPlayer.offsetLeft) / 300 * audio.duration;
                update();
            }
        }
        progressDot.onmousedown = (e) => {
            if (e.button === 2) return;
            draggingDot = true;
            musicPlayer.onmousedown = null;
            document.onmousemove = (e) => {
                updateLocation(e);
                setLookingAtMouse(e);
            }
            document.onmouseup = (e) => {
                updateLocation(e)
                audio.currentTime = (dotPositionX - 3) / 300 * audio.duration;
                document.onmousemove = null;
                draggingDot = false;
                update();
                setPlayerDrag();
                setLookingAtMouseMove(e);
            }
        }
    })

    function updateLocation(e) {
        let x = e.clientX - musicPlayer.offsetLeft;
        if (x < 0) {
            dotPositionX = 0;
        } else if (x > 300) {
            dotPositionX = 300;
        } else {
            dotPositionX = x;
        }
        progress.style.width = (dotPositionX) + 'px'
        progressDot.style.left = (dotPositionX - 3) + 'px';
        let time = (dotPositionX - 3) / 300 * audio.duration;
        if (time < 10) {
            currentTime.innerHTML = "0:0" + Math.floor(time);
        } else if (time < 60) {
            currentTime.innerHTML = "0:" + Math.floor(time);
        } else {
            let minute = Math.floor(time / 60);
            let sec = Math.floor(time - minute * 60);
            if (sec < 10) {
                currentTime.innerHTML = "0" + minute + ":" + "0" + sec;
            } else {
                currentTime.innerHTML = "0" + minute + ":" + sec;
            }
        }
    }

    update();
    //设置进度条
    progressTimer = setInterval(update, 1000);

    function update() {
        if (!draggingDot) {
            progress.style.width = (audio.currentTime) * 100 / (audio.duration) + "%";
            progressDot.style.left = "calc(" + (audio.currentTime) * 100 / (audio.duration) + "%" + " - 3px";
            updateCurrentTime(currentTime);
            if (audio.currentTime >= audio.duration - 1)//片尾跳转下一曲
            {
                if (playMode === 1) {
                    switchMusic(musicIndex);
                } else {
                    playerRealDrag = false;
                    nextMusic();
                }
            }
        }
    }
}

function updatePlayList() {
    let playListContent = document.getElementById('playListContent');
    playListContent.innerHTML = "";
    let gray = true;
    for (let i = musicIndex + 1; i < musicArrayPlayList.length; i++) {
        if (isDeleted(musicArrayPlayList, i)) continue;
        addChildToPlayList(i, gray, playListContent);
        gray = !gray;
    }
    for (let i = 0; i < musicIndex; i++) {
        if (isDeleted(musicArrayPlayList, i)) continue;
        addChildToPlayList(i, gray, playListContent);
        gray = !gray;
    }
    let item = document.createElement("li");
    item.className = gray
        ? "playListItem grayItem"
        : "playListItem whiteItem";
    let div = document.createElement("div");
    div.innerText = "- - - - - - - -END- - - - - - - -";
    div.classList.add("endItem");
    item.appendChild(div);
    playListContent.appendChild(item);
    for (let i = 0; i < musicArrayPlayList.length; i++) {
        if (isDeleted(musicArrayPlayList, i)) {
            addDeletedChildToPlayList(i, gray, playListContent);
            gray = !gray;
        }
    }
}

function addChildToPlayList(index, gray, list) {
    let item = document.createElement("li");
    item.className = gray
        ? "playListItem grayItem"
        : "playListItem whiteItem";
    let div = document.createElement("div");
    div.classList.add("playListItemStyle")
    div.innerText = getMusicTitle(index);
    div.indexNumber = index;
    item.appendChild(div);
    let trash = document.createElement("div");
    trash.classList.add("playListItemOp");
    trash.classList.add("playListItemDelete");
    trash.indexNumber = index;
    item.appendChild(trash);
    div.onclick = (e) => {
        switchMusic(e.target.indexNumber);
    }
    trash.onclick = (e) => {
        deleteFromList(e.target.indexNumber);
    }
    list.appendChild(item);
}

function addDeletedChildToPlayList(index, gray, list) {
    let item = document.createElement("li");
    item.className = gray
        ? "playListItem grayItem"
        : "playListItem whiteItem";
    let div = document.createElement("div");
    div.classList.add("playListItemStyle")
    div.innerText = getMusicTitle(index);
    div.indexNumber = index;
    item.appendChild(div);
    let add = document.createElement("div");
    add.classList.add("playListItemOp");
    add.classList.add("playListItemAdd");
    add.indexNumber = index;
    item.appendChild(add);
    div.onclick = (e) => {
        switchMusic(e.target.indexNumber);
    }
    add.onclick = (e) => {
        restoreToList(e.target.indexNumber);
    }
    list.appendChild(item);
}

function getMusicTitle(index) {
    const options = {
        include: ['TIT2', 'TPE1']
    }
    let tags = NodeID3.read(__dirname + "\\music\\" + musicArrayPlayList[index], options);
    return tags.title + " --- " + tags.artist;
}

function switchMusic(index) {
    musicIndex = index;

    audio.src = __dirname + "\\music\\" + musicArrayPlayList[musicIndex];
    audio.volume = volume;


    //设置封面
    const options = {
        include: ['APIC']
    }
    let musicTags = NodeID3.read(__dirname + "\\music\\" + musicArrayPlayList[musicIndex], options);
    let cover = document.getElementById('musicPic');
    if ("image" in musicTags) {
        let bytes = new Uint8Array(musicTags.image.imageBuffer);
        let data = "";
        let len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            data += String.fromCharCode(bytes[i]);
        }
        cover.src = "data:" + musicTags.image.mime + ";base64," + window.btoa(data);
    } else {
        cover.src = "paimon.PNG"
    }


    updatePlayList();
    setProgressTimer();
    //设置标题
    setTitle();
    audio.play();
}

function setTitle() {
    clearInterval(titleRollTimer)
    clearTimeout(titleRollTimer)
    //基础设置
    let name = document.getElementById('name');
    let nameSpan = document.getElementById('nameSpan');
    let nameSpanCpy = document.getElementById('nameSpanCopy');
    nameSpanCpy.style.opacity = '1';
    let title = getMusicTitle(musicIndex);
    nameSpan.innerText = title;
    nameSpanCpy.innerText = title;
    nameSpanCpy.style.paddingLeft = "50px";

    //小标题设置
    let tmpTitleBar = document.getElementById('tmpTitleBar');
    tmpTitleBar.innerText = title;

    //滚动函数
    name.scrollLeft = 0;

    function roll() {
        if (name.scrollLeft >= nameSpanCpy.offsetWidth) {
            name.scrollLeft -= nameSpan.offsetWidth + 50;
        } else {
            name.scrollLeft++;
        }
    }

    if (nameSpan.offsetWidth <= name.clientWidth) {
        nameSpanCpy.style.opacity = '0';
    } else {

        titleRollTimer = setTimeout(() => {
            titleRollTimer = setInterval(roll, 100);
        }, 3000)
    }
}

function switchMode() {
    if (playerRealDrag) {
        playerRealDrag = false;
        return;
    }
    playMode = (++playMode + 3) % 3;
    let playModeBtn = document.getElementById('playModeBtn');
    if (playMode === 0) {
        playModeBtn.style.backgroundImage = "url('img/musicControl/cycleC.png')";
        playModeBtn.onmouseenter = () => {
            playModeBtn.style.backgroundImage = "url('img/musicControl/cycleC.png')";
        }
        playModeBtn.onmouseleave = () => {
            playModeBtn.style.backgroundImage = "url('img/musicControl/cycle.png')";
        }
        musicArrayPlayList = musicArray;
    } else if (playMode === 1) {
        playModeBtn.style.backgroundImage = "url('img/musicControl/singleC.png')";
        playModeBtn.onmouseenter = () => {
            playModeBtn.style.backgroundImage = "url('img/musicControl/singleC.png')";
        }
        playModeBtn.onmouseleave = () => {
            playModeBtn.style.backgroundImage = "url('img/musicControl/single.png')";
        }
        musicArrayPlayList = musicArray;
    } else {
        playModeBtn.style.backgroundImage = "url('img/musicControl/randomC.png')";
        playModeBtn.onmouseenter = () => {
            playModeBtn.style.backgroundImage = "url('img/musicControl/randomC.png')";
        }
        playModeBtn.onmouseleave = () => {
            playModeBtn.style.backgroundImage = "url('img/musicControl/random.png')";
        }
        musicArrayPlayList = musicArray.slice().sort(function () {
            return Math.random() - 0.5;
        });
        musicArrayPlayList[musicArrayPlayList.indexOf(musicArray[musicIndex])] = musicArrayPlayList[musicIndex];
        musicArrayPlayList[musicIndex] = musicArray[musicIndex];
    }
    updatePlayList();
}

//音乐时间显示
function updateCurrentTime(currentTime) {
    if (audio.currentTime < 10) {
        currentTime.innerHTML = "0:0" + Math.floor(audio.currentTime);
    } else if (audio.currentTime < 60) {
        currentTime.innerHTML = "0:" + Math.floor(audio.currentTime);
    } else {
        let minute = Math.floor(audio.currentTime / 60);
        let sec = Math.floor(audio.currentTime - minute * 60);
        if (sec < 10) {
            currentTime.innerHTML = "0" + minute + ":" + "0" + sec;
        } else {
            currentTime.innerHTML = "0" + minute + ":" + sec;
        }
    }
}

//展示或者隐藏播放列表
function showHidePlayList() {
    if (playerRealDrag) {
        playerRealDrag = false;
        return;
    }
    let playList = document.getElementById('playList');
    if (!playListOn) {
        if (musicArrayPlayList.length > 10) {
            playList.style.height = "300px";
        } else {
            playList.style.height = musicArrayPlayList.length * 30 + 'px';
        }
    } else {
        playList.style.height = "0px";
    }
    playListOn = !playListOn;
}

function showFileFolder() {
    let fileChooser = document.getElementById("fileChooser");
    fileChooser.click();
    fileChooser.value = null;
    fileChooser.onchange = (e) => {
        uploadMusic(e);
    }
}

function uploadMusic(event) {
    let files = event.target.files || event.dataTransfer.files;
    for (let i = 0; i < files.length; i++) {
        let exists = false;
        for (let j = 0; j < musicArray.length; j++) {
            if (musicArray[j] === files[i].name) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            copy(files[i].path, __dirname + "\\music\\" + files[i].name);
        }

    }
}

function copy(src, dst) {
    fs.writeFileSync(dst, fs.readFileSync(src));
}

function deleteFromList(index) {
    deletedArray.push(musicArrayPlayList[index]);
    updatePlayList();
}

function isDeleted(array, index) {
    for (let i = 0; i < deletedArray.length; i++) {
        if (array[index] === deletedArray[i]) {
            return true;
        }
    }
    return false;
}

function restoreToList(index) {
    for (let i = 0; i < deletedArray.length; i++) {
        if (musicArrayPlayList[index] === deletedArray[i]) {
            deletedArray.splice(i, 1);
            break;
        }
    }
    updatePlayList();
}

function setVolumeBar() {
    //设置时长和进度条
    let volumeProgress = document.getElementById('volume');
    let volumeBar = document.getElementById('volumeBar');
    let volumeDot = document.getElementById('volumeDot');
    let draggingDot = false;
    let dotPositionX;
    volumeProgress.style.width = (100 * audio.volume + 10) + 'px'
    volumeDot.style.left = (100 * audio.volume) + 'px';

    volumeBar.onclick = (e) => {
        if (playerRealDrag) {
            playerRealDrag = false;
        } else {
            updateVolume(e)
        }
    }
    volumeDot.onmousedown = (e) => {
        if (e.button === 2) return;
        draggingDot = true;
        musicPlayer.onmousedown = null;
        document.onmousemove = (e) => {
            updateVolume(e);
            setLookingAtMouse(e)
        }
        document.onmouseup = (e) => {
            updateVolume(e);
            document.onmousemove = null;
            draggingDot = false;
            setPlayerDrag();
            setLookingAtMouseMove(e);
        }
    }

    function updateVolume(e) {
        let x = e.clientX - musicPlayer.offsetLeft - 175;
        if (x < 10) {
            dotPositionX = 10;
        } else if (x > 110) {
            dotPositionX = 110;
        } else {
            dotPositionX = x;
        }
        volumeProgress.style.width = (dotPositionX) + 'px'
        volumeDot.style.left = (dotPositionX - 10) + 'px';
        volume = (dotPositionX - 10) / 100;
        let volumeBtn = document.getElementById("volumeBtn");
        volumeBtn.removeAttribute('class');
        volumeBtn.classList.add('controlBtn');
        if (volume === 0) {
            volumeBtn.classList.add("volumeNo");
        } else if (volume <= 0.3) {
            volumeBtn.classList.add("volumeLittle");
        } else if (volume <= 0.7) {
            volumeBtn.classList.add("volumeSome");
        } else {
            volumeBtn.classList.add("volumeALot");
        }
        audio.volume = volume;
    }

    volumeBar.onmouseleave = (e) => {
        showHideVolumeBar();
        document.onmousemove = null;
        setLookingAtMouseMove(e);
        document.onmouseup = null;
        draggingDot = false;
        setPlayerDrag();
    }
}

function showHideVolumeBar() {
    if (playerRealDrag) {
        playerRealDrag = false;
        return;
    }
    clearTimeout(volumeBarTimer);
    let volumeBar = document.getElementById('volumeBar');
    volumeBarTimer = setTimeout(() => {
        if (!volumeBarOn) {
            volumeBar.classList.remove("noDisplay");
            setVolumeBar();
        } else {
            volumeBar.classList.add("noDisplay");
        }
        volumeBarOn = !volumeBarOn;
    }, 200)

}

function mute() {
    clearTimeout(volumeBarTimer);
    if (volume === 0 && tmpVolume === 0) {
        return;
    }
    let volumeBtn = document.getElementById("volumeBtn");
    volumeBtn.classList.add('controlBtn');
    volumeBtn.classList.remove('volumeNo');
    volumeBtn.classList.remove('volumeLittle');
    volumeBtn.classList.remove('volumeSome');
    volumeBtn.classList.remove('volumeALot');
    if (volume > 0) {
        tmpVolume = volume;
        volume = 0;
        volumeBtn.classList.add("volumeNo");
    } else {
        volume = tmpVolume;
        tmpVolume = 0;
        if (volume <= 0.3) {
            volumeBtn.classList.add("volumeLittle");
        } else if (volume <= 0.7) {
            volumeBtn.classList.add("volumeSome");
        } else {
            volumeBtn.classList.add("volumeALot");
        }
    }
    audio.volume = volume;
}

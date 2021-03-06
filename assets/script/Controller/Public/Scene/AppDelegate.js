cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...

        exitTime: 0,
        appUpdatePrefab: cc.Prefab, // app update
    },

    // use this for initialization
    onLoad() {
        cc.game.addPersistRootNode(this.node);

        // 初始化全局类
        window.Global = {};
        window.Global.Config = require('GlobalConfig');
        window.Global.NetworkManager = require('NetworkManager');
        window.Global.NetworkConfig = require('GlobalNetwork');
        window.Global.NativeExtensionManager = require('NativeExtensionManager').init();
        window.Global.Animation = this.node.getComponent('Animation');
        window.Global.Tools = this.node.getComponent('Tools');
        window.Global.Dialog = this.node.getComponent('Dialog');
        window.Global.SoundEffect = require('SoundEffect');

        // 初始化萍乡258游戏
        window.PX258 = {};
        window.PX258.Config = require('PX258Config');
        window.PX258.NetworkConfig = require('PX258Network');

        window.DDZ = {};
        window.DDZ.Config = require('DDZConfig');
        window.DDZ.Tools = require('DDZTools');

        // 初始化本地数据
        if (!window.Global.Tools.getLocalData(window.Global.Config.LSK.userInfo_location)) {
            window.Global.Tools.setLocalData(window.Global.Config.LSK.userInfo_location, '该用户未公开地理位置');
        }
        if (!window.Global.Tools.getLocalData(window.Global.Config.LSK.playMusicConfig)) {
            window.Global.Tools.setLocalData(window.Global.Config.LSK.playMusicConfig, { music: true, effect: true });
        }
        window.Global.Tools.setLocalData(window.Global.Config.LSK.appleReview, false);

        // 初始化背景音效
        window.Global.SoundEffect.backgroundMusicPlay(window.Global.Config.audioUrl.background.menu, true);

        this.schedule(this.hbt.bind(this), window.Global.Config.debug ? window.Global.Config.development.hbtTime : window.Global.Config.production.hbtTime);

        // window.Global.Tools.setLocalData(window.Global.Config.LSK.secretKey, '91d3e19c-1762-11e7-a41e-00163e10f210');

        window.Global.Dialog.openLoading();

        // 装载资源
        cc.loader.loadResDir('Texture', function(err, assets) {
            cc.log(['AppDelegate.onLoad: 资源装载完成', err, assets]);
        });

        if (cc.sys.isNative) {
            // 检查应用更新
            this.httpCheckUpdate(function() {
                // 检查热更新
                var hotUpdateManager = cc.director.getScene().getChildByName('Canvas').getComponent('HotUpdateManager');
                hotUpdateManager.init();
                hotUpdateManager.hotUpdate(function(code) {
                    if (code !== 0) {
                        cc.director.loadScene('Login');
                    }
                    // else if (code == 4) {
                    //     // window.Global.SoundEffect.backgroundMusicClear();
                    // }
                });

                if (!window.Global.Tools.getLocalData(window.Global.Config.LSK.appleReview)) {
                    window.Global.NativeExtensionManager.execute('startLocation', [], (result) => {
                        window.Global.Tools.setLocalData(window.Global.Config.LSK.userInfo_location, result.result == 0 ? result.data : '该用户未公开地理位置');
                    });
                }
            });

            // TODO: 删除本地音频文件
            // window.Global.NativeExtensionManager.execute('deleteAudioCache');

            // native test
            window.Global.NativeExtensionManager.execute('test', [], (result) => {
                cc.log(result);
            });

            if (cc.sys.os === cc.sys.OS_ANDROID) {
                cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, (event) => {
                    cc.log(this.exitTime);
                    if (event.keyCode === cc.KEY.back) {
                        if ((+new Date() - this.exitTime) > 2000) {
                            this.exitTime = +new Date();
                        }
                        else {
                            cc.game.end();
                        }
                    }
                    cc.log(`cc.SystemEvent.EventType.KEY_UP: ${event.keyCode}`);
                }, this);
            }
        }

        if (cc.sys.isBrowser) {
            cc.director.loadScene('Login');
        }
    },

    onDestroy() {
        delete window.Global;
    },

    hbt () {
        if (!window.Global.Tools.getLocalData(window.Global.Config.LSK.secretKey) ||
            !window.Global.Tools.getLocalData(window.Global.Config.LSK.userInfo)) {
            return;
        }
        window.Global.NetworkManager.httpRequest(window.Global.NetworkConfig.HttpRequest.heartbeat, {}, (event, result) => {
            if (result.code === 1) {
                const scene = cc.director.getScene();
                if (result.isLogin == 0 || result.isLogin == 2) {
                    if (scene.name === 'GameRoom') {
                        window.Global.NetworkManager.close();
                    }
                    window.Global.Tools.setLocalData(window.Global.Config.LSK.secretKey, '');
                    cc.director.loadScene('Login');
                }

                if (scene.name === 'Lobby') {
                    const lobbyScene = scene.getChildByName('Canvas').getComponent('LobbyScene');
                    lobbyScene.money.string = result.gold;
                }

                const userInfo = window.Global.Tools.getLocalData(window.Global.Config.LSK.userInfo);
                userInfo.gold = result.gold;
                window.Global.Tools.setLocalData(window.Global.Config.LSK.userInfo, userInfo);
            }
        });
    },

    httpCheckUpdate(callback) {
        window.Global.NetworkManager.httpRequest(window.Global.NetworkConfig.HttpRequest.check, {}, (event, result) => {
            window.Global.Tools.setLocalData(window.Global.Config.LSK.appleReview, result.isCheck);
            if (result.code === 1000) {
                var node = cc.instantiate(this.appUpdatePrefab);
                node.getComponent('AppUpdate').init(result, function() {
                    callback();
                });
                var parent = cc.director.getScene().getChildByName('Canvas');
                window.Global.Animation.openDialog(node, parent);
            }
            else {
                callback();
            }
        });
    },

});
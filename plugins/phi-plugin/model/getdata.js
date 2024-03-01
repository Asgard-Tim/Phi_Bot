
import fs from 'node:fs'
import { _path } from "./path.js";
import { segment } from "oicq";
import Film from './Doc.js';
import atlas from "./picmodle.js";
import Config from "../components/Config.js";
import LevelRecord from "./class/LevelRecordInfo.js";
import SongsInfo from './class/SongsInfo.js';
import Save from './class/Save.js';
import PhigrosUser from '../lib/PhigrosUser.js';
import send from './send.js';
import common from '../../../lib/common/common.js'
import scoreHistory from './class/scoreHistory.js'


let lock = []

class getdata {


    constructor() {
        /**曲绘资源、曲目信息路径 */
        // this.infoPath = `E:/bot/233/Miao-Yunzai/plugins/phi-plugin/resources/info/`
        this.infoPath = `${_path}/plugins/phi-plugin/resources/info/`
        this.DlcInfoPath = `${_path}/plugins/phi-plugin/resources/info/DLC/`

        /**用户数据路径 */
        // this.userPath = `E:/bot/233/Miao-Yunzai/plugins/phi-plugin/data/`
        this.userPath = `${_path}/plugins/phi-plugin/data/`

        /**用户娱乐数据路径 */
        this.pluginDataPath = `${_path}/plugins/phi-plugin/data/pluginData/`

        /**用户设置路径 */
        this.configPath = `${_path}/plugins/phi-plugin/config/config/`

        /**默认设置路径 */
        this.defaultPath = `${_path}/plugins/phi-plugin/config/default_config/`

        /**默认图片路径 */
        this.imgPath = `${_path}/plugins/phi-plugin/resources/html/otherimg/`

        /**用户图片路径 */
        this.orillPath = `${_path}/plugins/phi-plugin/resources/otherill/`

        /**音频资源 */
        this.guessMicPath = `${_path}/plugins/phi-plugin/resources/splited_music/`

        /**资源路径 */
        this.resPath = `${_path}/plugins/phi-plugin/resources/`

        /**插件路径 */
        this.pluginPath = `${_path}/plugins/phi-plugin/`


        this.Level = ['EZ', 'HD', 'IN', 'AT', 'LEGACY'] //难度映射

        this.MAX_DIFFICULTY = 16.9
    }

    async init() {

        /**之前写错了，一不小心把.json的文件也当成文件夹创建了，这里要去清除空文件夹 */
        try {
            Film.rmEmptyDir(this.userPath)
        } catch (error) {
            logger.warn(error)
        }
        /**之前改过一次名称，修正别名 */
        let nick = await this.getData('nickconfig.yaml', this.configPath, 'TXT')
        if (nick) {
            const waitToReplace = {
                "Winter↑cube↓": "Winter ↑cube↓",
                "Cipher: /2&//<|0": "Cipher : /2&//<|0",
                "NYA!!!(Phigros ver.)": "NYA!!! (Phigros ver.)",
                "JunXion Between Life And Death(VIP Mix)": "JunXion Between Life And Death(VIP Mix)",
                "Dash from SOUL NOTES": "Dash",
                "Drop It from SOUL NOTES": "Drop It",
                "Diamond Eyes from SOUL NOTES": "Diamond Eyes",
            }
            let flag = false
            for (let i in waitToReplace) {
                if (nick.includes(i)) {
                    flag = true
                    nick = nick.replace(i, waitToReplace[i])
                }
            }
            if (flag) {
                await get.setData('nickconfig.yaml', nick, this.configPath, 'TXT')
                logger.info('[phi-plugin]自动修正别名')
            }
        }

        /**附加信息 */
        const Jsoninfo = await this.getData('infolist.json', this.infoPath)

        /**扩增曲目信息 */
        this.arcName = await this.getData('arc.json', this.DlcInfoPath)
        this.orzName = await this.getData('orz.json', this.DlcInfoPath)

        /**SP信息 */
        this.sp_info = await this.getData('spinfo.json', this.infoPath)
        /**默认别名 */
        let Yamlnick = await this.getData('nicklist.yaml', this.infoPath)

        this.songnick = {}

        for (let i in Yamlnick) {
            for (let j in Yamlnick[i]) {
                if (this.songnick[Yamlnick[i][j]]) {
                    this.songnick[Yamlnick[i][j]].push(i)
                } else {
                    this.songnick[Yamlnick[i][j]] = [i]
                }
            }
        }


        /**头像id */
        this.avatarid = await this.getData('avatarid.yaml', this.infoPath)
        /**Tips */
        this.tips = await this.getData('tips.yaml', this.infoPath)

        /**csv文件 */
        const CsvInfo = await this.getData('info.csv', this.infoPath)
        const Csvdif = await this.getData('difficulty.csv', this.infoPath)

        /**原版信息 */
        this.ori_info = {}
        /**通过id获取曲名 */
        this.songsid = {}
        /**原曲名称获取id */
        this.idssong = {}

        for (let i in CsvInfo) {
            switch (CsvInfo[i].id) {
                case 'AnotherMe.DAAN': {
                    CsvInfo[i].song = 'Another Me (KALPA)';
                    break;
                }
                case 'AnotherMe.NeutralMoon': {
                    CsvInfo[i].song = 'Another Me (Rising Sun Traxx)';
                    break;
                }
                default: {
                    break;
                }
            }
            this.songsid[CsvInfo[i].id + '.0'] = CsvInfo[i].song
            this.idssong[CsvInfo[i].song] = CsvInfo[i].id + '.0'

            this.ori_info[CsvInfo[i].song] = Jsoninfo[CsvInfo[i].id]
            if (!this.ori_info[CsvInfo[i].song]) {
                /**illustration_big = 'null'为特殊标记，getill时会返回默认图片 */
                this.ori_info[CsvInfo[i].song] = { song: CsvInfo[i].song, illustration_big: 'null', chapter: '', bpm: '', length: '', chart: {} }
                logger.info(`[phi-plugin]曲目详情未更新：${CsvInfo[i].song}`)
            }
            this.ori_info[CsvInfo[i].song].song = CsvInfo[i].song
            this.ori_info[CsvInfo[i].song].id = CsvInfo[i].id
            this.ori_info[CsvInfo[i].song].composer = CsvInfo[i].composer
            this.ori_info[CsvInfo[i].song].illustrator = CsvInfo[i].illustrator
            for (let j in this.Level) {
                const level = this.Level[j]
                if (CsvInfo[i][level]) {
                    if (!this.ori_info[CsvInfo[i].song].chart[level]) {
                        this.ori_info[CsvInfo[i].song].chart[level] = {}
                    }
                    this.ori_info[CsvInfo[i].song].chart[level].charter = CsvInfo[i][level]
                    this.ori_info[CsvInfo[i].song].chart[level].difficulty = Csvdif[i][level]
                }
            }
        }



        /**含有曲绘的曲目列表，原曲名称 */
        this.illlist = []

        let info = this.info(undefined, false)
        for (let i in info) {
            const id = info[i].id
            if (info[i]['illustration_big'] || (id && (fs.existsSync(`${this.resPath}original_ill/${id.replace(/.0$/, '.png')}`) || fs.existsSync(`${this.resPath}original_ill/ill/${id.replace(/.0$/, '.png')}`)))) {
                this.illlist.push(info[i].song)
            }
        }


        /**所有曲目曲名列表 */
        this.songlist = []

        for (let i in this.ori_info) {
            this.songlist.push(this.ori_info[i].song)
        }


    }

    /**
     * @param {string} [song=undefined] 原曲曲名
     * @param {boolean} [init=false] 是否格式化
     */
    info(song = undefined, init = true) {
        let result
        switch (Config.getDefOrConfig('config', 'otherinfo')) {
            case 0: {
                result = { ...this.ori_info, ...this.sp_info }
                break;
            }
            case 1: {
                result = { ...this.ori_info, ...this.sp_info, ...Config.getDefOrConfig('otherinfo') }
                break;
            }
            case 2: {
                result = Config.getDefOrConfig('otherinfo')
                break;
            }
        }
        if (song) {
            return init ? new SongsInfo(result[song]) : result[song]
        } else {
            return result
        }
    }

    /**获取 chos 文件 
     * @param {string}  chos 文件名称 含后缀 yaml json
     * @param {string}  path 路径
     * @param {'JSON'|'YAML'|'CSV'|'TXT'} [style=undefined] 
    */
    async getData(chos, path, style = undefined) {
        return await Film.FileReader(`${path}${chos}`, style)

        if (chos.includes('.yaml')) {
            return Film.YamlReader(`${path}${chos}`, path)
        } else {
            return Film.JsonReader(`${path}${chos}`, path)
        }
    }

    /**修改 chos 文件为 data 
     * @param {string} chos 文件名称 含后缀 yaml json
     * @param {any} data 覆写内容
     * @param {string} path 父路径
     * @param {'JSON'|'YAML'|'TXT'} [style=undefined] 文件类型
    */
    async setData(chos, data, path, style = undefined) {
        return await Film.SetFile(chos, path, data, style)
        if (chos.includes('.yaml')) {
            return Film.SetYaml(`${path}${chos}`, data, path)
        } else {
            return Film.SetJson(`${path}${chos}`, data, path)
        }
    }

    /**删除 chos.yaml 文件
     * @param {string} chos 文件名称 含后缀 yaml json
     * @param {string} path 路径
    */
    delData(chos, path) {
        if (!Film.DelFile(`${path}${chos}`)) {
            logger.info(`[phi插件] ${chos} 已删除`)
            return false
        } else {
            return true
        }
    }


    /**
     * 获取QQ号对应的存档文件
     * @param {String} id user_id
     * @returns save
     */
    async getsave(id) {
        let result = await this.getData(`${id}.json`, `${this.userPath}`)
        if (result) {
            return new Save(result)
        } else {
            return null
        }

    }

    /**
     * 保存QQ号对应的存档文件
     * @param {String} id user_id
     * @param {Object} data 
     */
    async putsave(id, data) {
        return await this.setData(`${id}.json`, data, `${this.userPath}`)
    }

    /**
     * 删除QQ号对应的存档文件
     * @param {String} id user_id
     */
    async delsave(id) {
        return this.delData(`${id}.json`, this.userPath)
    }

    /**
     * 删除QQ号对应的娱乐数据
     * @param {String} id user_id
     */
    async delpluginData(id) {
        return this.delData(`${id}_.json`, `${this.pluginDataPath}`)
    }

    /**
     * 获取QQ号对应的娱乐数据
     * @param {String} user_id 
     * @param {boolean} [islock=false] 是否锁定文件
     * @returns save
     */
    async getpluginData(id, islock = false) {

        islock = false //暂时先不锁

        if (lock.indexOf(id) != -1) {
            logger.info(`[phi-plugin][${id}]文件读取等待中`)
            let tot = 0
            while (lock.indexOf(id) != -1 && tot < 20) {
                await common.sleep(500)
                ++tot
            }
            if (tot == 20) {
                logger.error(`[phi-plugin][${id}]文件读取失败！`)
                throw new Error(`[phi-plugin][${id}]文件读取失败！`)
            }
        }

        if (islock) {
            lock.push(id)
        }
        return await this.getData(`${id}_.json`, `${this.pluginDataPath}`)
    }

    /**
     * 保存QQ号对应的娱乐数据，并解锁文件
     * @param {String} id user_id
     * @param {Object} data 
     */
    async putpluginData(id, data) {
        let returns = await this.setData(`${id}_.json`, data, `${this.pluginDataPath}`)
        if (lock.indexOf(id) != -1) {
            delete lock[lock.indexOf(id)]
        }
        return returns
    }

    /**
     * 取消对id文件的锁定
     * @param {String} id 用户id
     */
    async delLock(id) {
        if (lock.indexOf(id) != -1) {
            delete lock[lock.indexOf(id)]
        }
    }

    /**
     * 获取并初始化 id 插件相关数据
     * @param {String} id 
     * @param {boolean} [islock=false] 是否锁定
     * @returns 整个data对象
     */
    async getmoneydata(id, islock = false) {

        islock = false //暂时先不锁

        let data = await this.getpluginData(id, islock)
        if (!data) {
            data = {}
        }
        if (!data.plugin_data || !data.plugin_data.task_time) {
            data.plugin_data = {
                money: 0,
                CLGMOD: {},
                sign_in: 'Thu Jul 27 2023 11:40:26 GMT+0800 (中国标准时间)',
                task_time: 'Thu Jul 27 2023 11:40:26 GMT+0800 (中国标准时间)',
                task: [],
                theme: 'default',
            }
        }
        return data
    }

    /**获取本地图片
     * @param {string} img 文件名
     * @param {string} style 文件格式，默认为png
     */
    getimg(img, style = 'png') {
        // name = 'phi'
        let url = `${this.imgPath}/${img}.${style}`
        if (url) {
            return segment.image(url)
        }
        logger.info('未找到 ' + `${img}.${style}`)
        return false
    }

    /**
     * 获取玩家 Dan 数据
     * @param {string} id QQ号
     * @returns dan[0]
     */
    async getDan(id) {
        let plugindata = await this.getpluginData(id)

        let dan = plugindata?.plugin_data?.CLGMOD

        if (dan && Object.prototype.toString.call(dan) == '[object Array]') {
            dan = dan[0]
        }
        return dan
    }

    /**
     * 匹配歌曲名称，根据参数返回原曲名称
     * @param {string} mic 别名
     * @returns 原曲名称
     */
    songsnick(mic) {
        let nickconfig = Config.getDefOrConfig('nickconfig', mic)
        let all = []

        if (this.info()[mic]) all.push(mic)

        if (this.songnick[mic]) {
            for (let i in this.songnick[mic]) {
                all.push(this.songnick[mic][i])
            }
        }
        if (nickconfig) {
            for (let i in nickconfig) {
                all.push(nickconfig[i])
            }
        }
        if (all.length) {
            all = Array.from(new Set(all)) //去重
            return all
        }
        return false
    }

    //采用Jaro-Winkler编辑距离算法来计算str间的相似度，复杂度为O(n)=>n为较长的那个字符出的长度
    jaroWinklerDistance(s1, s2) {
        let m = 0 //匹配的字符数量

        //如果任任一字符串为空则距离为0
        if (s1.length === 0 || s2.length === 0) {
            return 0
        }

        //字符串完全匹配，距离为1
        if (s1 === s2) {
            return 1
        }

        let range = (Math.floor(Math.max(s1.length, s2.length) / 2)) - 1, //搜索范围
            s1Matches = new Array(s1.length),
            s2Matches = new Array(s2.length)

        //查找匹配的字符
        for (let i = 0; i < s1.length; i++) {
            let low = (i >= range) ? i - range : 0,
                high = (i + range <= (s2.length - 1)) ? (i + range) : (s2.length - 1)

            for (let j = low; j <= high; j++) {
                if (s1Matches[i] !== true && s2Matches[j] !== true && s1[i] === s2[j]) {
                    ++m
                    s1Matches[i] = s2Matches[j] = true
                    break
                }
            }
        }

        //如果没有匹配的字符，那么捏Jaro距离为0
        if (m === 0) {
            return 0
        }

        //计算转置的数量
        let k = 0, n_trans = 0
        for (let i = 0; i < s1.length; i++) {
            if (s1Matches[i] === true) {
                let j
                for (j = k; j < s2.length; j++) {
                    if (s2Matches[j] === true) {
                        k = j + 1
                        break
                    }
                }

                if (s1[i] !== s2[j]) {
                    ++n_trans
                }
            }
        }

        //计算Jaro距离
        let weight = (m / s1.length + m / s2.length + (m - (n_trans / 2)) / m) / 3,
            l = 0,
            p = 0.1

        //如果Jaro距离大于0.7，计算Jaro-Winkler距离
        if (weight > 0.7) {
            while (s1[l] === s2[l] && l < 4) {
                ++l
            }

            weight = weight + l * p * (1 - weight)
        }

        return weight
    }

    /**
    * 根据参数模糊匹配返回原曲名称
    * @param {string} mic 别名
    * @param {number} [Distance=0.85] 阈值
    * @returns 原曲名称数组，按照匹配程度降序
    */
    fuzzysongsnick(mic, Distance = 0.85) {

        const fuzzyMatch = (str1, str2) => {
            if (str1 == str2) {
                return 1
            }
            //首先第一次去除空格和其他符号，并转换为小写
            const pattern = /[\s~`!@#$%^&*()\-=_+\]{}|;:'",<.>/?！￥…（）—【】、；‘：“”，《。》？↑↓←→]/g
            const formattedStr1 = str1.replace(pattern, '').toLowerCase()
            const formattedStr2 = str2.replace(pattern, '').toLowerCase()

            //第二次再计算str1和str2之间的JaroWinkler距离
            const distance = this.jaroWinklerDistance(formattedStr1, formattedStr2)

            //如果距离大于等于某个阈值，则认为匹配
            //可以根据实际情况调整这个阈值
            return distance
        }

        /**按照匹配程度排序 */
        let result = []

        const usernick = Config.getDefOrConfig('nickconfig')
        const allinfo = this.info()


        for (let std in usernick) {
            let dis = fuzzyMatch(mic, std)
            if (dis >= Distance) {
                for (let i in usernick[std]) {
                    result.push({ song: usernick[std][i], dis: dis })
                }
            }
        }
        for (let std in this.songnick) {
            let dis = fuzzyMatch(mic, std)
            if (dis >= Distance) {
                for (let i in this.songnick[std]) {
                    result.push({ song: this.songnick[std][i], dis: dis })
                }
            }
        }
        for (let std in allinfo) {
            let dis = fuzzyMatch(mic, std)
            if (dis >= Distance) {
                result.push({ song: allinfo[std]['song'], dis: dis })
            }
        }

        result = result.sort((a, b) => b.dis - a.dis)

        let all = []
        for (let i in result) {

            if (all.includes(result[i].song)) continue //去重
            /**如果有完全匹配的曲目则放弃剩下的 */
            if (result[0].dis == 1 && result[i].dis < 1) break


            all.push(result[i].song)
        }

        return all
    }


    /**设置别名 原名, 别名 */
    async setnick(mic, nick) {
        if (!Config.getDefOrConfig('nickconfig', mic)) {
            Config.modify('nickconfig', nick, [mic])
        } else {
            Config.modifyarr('nickconfig', nick, mic, 'add')
        }
    }

    /**获取歌曲图鉴，曲名为原名 */
    GetSongsInfoAtlas(e, name, data = undefined) {

        if (!data) {
            data = this.info()[name]
        }
        if (data) {
            data.illustration = this.getill(name)
            return atlas.atlas(e, data)
        } else {
            /**未找到曲目 */
            return `未找到${name}的相关曲目信息!QAQ`
        }
    }

    /**
     * 通过曲目获取曲目图鉴
     * @param {*} e 消息e
     * @param {string} name 原曲名称
     * @param { {illustration:string, illustrator:string} } data 自定义数据
     * @returns 
     */
    async GetSongsIllAtlas(e, name, data = undefined) {
        if (data) {
            return await get.getillatlas(e, { illustration: data.illustration, illustrator: data.illustrator })
        } else {
            return await get.getillatlas(e, { illustration: get.getill(name), illustrator: get.info()[name]["illustrator"] })
        }

    }

    /**
     * 更新存档
     * @param {*} e 
     * @param {PhigrosUser} User 
     * @returns [rks变化值，note变化值]
     */
    async buildingRecord(e, User) {
        try {
            const err = await User.buildRecord()
            if (err.length) {
                send.send_with_At(e, "以下曲目无信息，可能导致b19显示错误\n" + err.join('\n'))
            }
        } catch (err) {
            send.send_with_At(e, "绑定失败！QAQ\n" + err)
            return false
        }
        let old = await this.getsave(e.user_id)

        if (old) {
            if (old.session) {
                if (old.session == User.session) {
                    // send.send_with_At(e, `你已经绑定了该sessionToken哦！将自动执行update...\n如果需要删除统计记录请 ⌈/${Config.getDefOrConfig('config', 'cmdhead')} unbind⌋ 进行解绑哦！`)
                } else {
                    send.send_with_At(e, `检测到新的sessionToken，将自动删除之前的存档记录……`)

                    await get.delsave(e.user_id)
                    let pluginData = await get.getpluginData(e.user_id, true)

                    pluginData.rks = []
                    pluginData.data = []
                    pluginData.dan = []
                    pluginData.scoreHistory = {}
                    if (pluginData.plugin_data) {
                        pluginData.plugin_data.task = []
                        pluginData.plugin_data.CLGMOD = []
                    }
                    await get.putpluginData(e.user_id, pluginData)
                }
            }
        }

        let pluginData = await this.getpluginData(e.user_id, true)

        try {
            await this.putsave(e.user_id, User)
        } catch (err) {
            send.send_with_At(e, `保存存档失败！\n${err}`)
            return false
        }

        if (!pluginData) {
            pluginData = {}
        }

        /**修正 */
        if (!pluginData.version || pluginData.version < 1.0) {
            /**v1.0,取消对当次更新内容的存储，取消对task的记录，更正scoreHistory */
            if (pluginData.update) {
                delete pluginData.update
            }
            if (pluginData.task_update) {
                delete pluginData.task_update
            }
            pluginData.version = 1
        }
        if (pluginData.version < 1.1) {
            /**v1.1,更正scoreHistory */
            delete pluginData.scoreHistory
            pluginData.version = 1.1
        }
        if (pluginData.version < 1.2) {
            /**v1.2,由于曲名错误，删除所有记录，曲名使用id记录 */
            delete pluginData.scoreHistory
            pluginData.version = 1.2
        }


        /**data历史记录 */
        if (!pluginData.data) {
            pluginData.data = []
        }
        /**rks历史记录 */
        if (!pluginData.rks) {
            pluginData.rks = []
        }


        let now = new Save(User)
        let date = User.saveInfo.modifiedAt.iso

        /**note数量变化 */
        let add_money = 0

        for (let song in now.gameRecord) {
            if (old && song in old.gameRecord) {
                for (let i in now['gameRecord'][song]) {
                    if (now['gameRecord'][song][i]) {
                        let nowRecord = now['gameRecord'][song][i]
                        let oldRecord = old['gameRecord'][song][i]
                        if (oldRecord && ((nowRecord.acc != oldRecord.acc) || (nowRecord.score != oldRecord.score) || (nowRecord.fc != oldRecord.fc))) {
                            add_money += add_new_score(pluginData, this.Level[i], song, nowRecord, oldRecord, new Date(now.saveInfo.updatedAt), new Date(old.saveInfo.updatedAt))
                        } else if (!oldRecord) {
                            add_money += add_new_score(pluginData, this.Level[i], song, nowRecord, undefined, new Date(now.saveInfo.updatedAt), new Date(old.saveInfo.updatedAt))
                        }
                    }
                }
            } else {
                for (let i in now['gameRecord'][song]) {
                    if (now['gameRecord'][song][i]) {
                        let nowRecord = now['gameRecord'][song][i]
                        add_money += add_new_score(pluginData, this.Level[i], song, nowRecord, undefined, new Date(now.saveInfo.updatedAt), undefined)
                    }
                }
            }
        }

        if (pluginData.data.length >= 2 && now.gameProgress.money == pluginData.data[pluginData.data.length - 2]['value']) {
            pluginData.data[pluginData.data.length - 1] = {
                "date": date,
                "value": now.gameProgress.money
            }
        } else {
            pluginData.data.push({
                "date": date,
                "value": now.gameProgress.money
            })
        }

        if (pluginData.rks.length >= 2 && now.saveInfo.summary.rankingScore == pluginData.rks[pluginData.rks.length - 2]['value']) {
            pluginData.rks[pluginData.rks.length - 1] = {
                "date": date,
                "value": now.saveInfo.summary.rankingScore
            }
        } else {
            pluginData.rks.push({
                "date": date,
                "value": now.saveInfo.summary.rankingScore
            })
        }

        /**rks变化 */
        let add_rks = 0
        if (pluginData.rks.length >= 2) {
            add_rks = now.saveInfo.summary.rankingScore - pluginData.rks[pluginData.rks.length - 2]['value']
        }

        await this.putpluginData(e.user_id, pluginData)

        return [add_rks, add_money]
    }

    /**获取best19图片 */
    async getb19(e, data) {
        return await atlas.b19(e, data)
    }

    /**获取update图片 */
    async getupdate(e, data) {
        return await atlas.update(e, data)
    }

    /**获取任务列表图片 */
    async gettasks(e, data) {
        return await atlas.tasks(e, data)
    }

    /**获取个人信息图片 */
    async getuser_info(e, data, kind) {
        return await atlas.user_info(e, data, kind)
    }

    /**获取定级区间成绩 */
    async getlvsco(e, data) {
        return await atlas.lvsco(e, data)
    }

    /**获取单曲成绩 */
    async getsingle(e, data) {
        return await atlas.score(e, data)
    }

    /**获取曲绘图鉴 */
    async getillatlas(e, data) {
        return await atlas.ill(e, data)
    }

    /**获取猜曲绘图片 */
    async getguess(e, data) {
        return await atlas.guess(e, data)
    }

    /**获取随机曲目图片 */
    async getrand(e, data) {
        return await atlas.rand(e, data)
    }

    /**获取曲绘，返回地址，原名
     * @param {string} name 原名
     * @param {'common'|'blur'|'low'} [kind='common'] 
     * @return 网址或文件地址
    */
    getill(name, kind = 'common') {
        const totinfo = { ...this.ori_info, ...this.sp_info, ...Config.getDefOrConfig('otherinfo') }
        let ans
        ans = totinfo[name]?.illustration_big
        let reg = /^(?:(http|https|ftp):\/\/)((?:[\w-]+\.)+[a-z0-9]+)((?:\/[^/?#]*)+)?(\?[^#]+)?(#.+)?$/i
        if (ans && !reg.test(ans) && ans != 'null') {
            ans = `${this.orillPath}${ans}`
        }
        if (this.ori_info[name]) {
            if (fs.existsSync(`${this.resPath}original_ill/${this.SongGetId(name).replace(/.0$/, '.png')}`)) {
                ans = `${this.resPath}original_ill/${this.SongGetId(name).replace(/.0$/, '.png')}`
            } else if (fs.existsSync(`${this.resPath}original_ill/ill/${this.SongGetId(name).replace(/.0$/, '.png')}`)) {
                if (kind == 'common') {
                    ans = `${this.resPath}original_ill/ill/${this.SongGetId(name).replace(/.0$/, '.png')}`
                } else if (kind == 'blur') {
                    ans = `${this.resPath}original_ill/illBlur/${this.SongGetId(name).replace(/.0$/, '.png')}`
                } else if (kind == 'low') {
                    ans = `${this.resPath}original_ill/illLow/${this.SongGetId(name).replace(/.0$/, '.png')}`
                }
            } else if (!ans) {
                if (kind == 'common') {
                    ans = `https://gitee.com/Steveeee-e/phi-plugin-ill/blob/main/ill/${this.SongGetId(name).replace(/.0$/, '.png')}`
                } else if (kind == 'blur') {
                    ans = `https://gitee.com/Steveeee-e/phi-plugin-ill/blob/main/illBlur/${this.SongGetId(name).replace(/.0$/, '.png')}`
                } else if (kind == 'low') {
                    ans = `https://gitee.com/Steveeee-e/phi-plugin-ill/blob/main/illLow/${this.SongGetId(name).replace(/.0$/, '.png')}`
                }
            }
        }
        if (!ans || ans == 'null') {
            ans = `${this.imgPath}phigros.png`
        }
        return ans
    }

    /**
     * 通过id获得头像文件名称
     * @param {string} id 
     * @returns file name
     */
    idgetavatar(id) {
        if (id) {
            return this.avatarid[id]
        } else {
            return 'Introduction'
        }
    }

    /**
     * 根据曲目id获取原名
     * @param {String} id 曲目id
     * @returns 原名
     */
    idgetsong(id) {
        return this.songsid[id]
    }

    /**
     * 通过原曲曲目获取曲目id
     * @param {String} song 原曲曲名
     * @returns 曲目id
     */
    SongGetId(song) {
        return this.idssong[song]
    }

    /**
     * 计算等效rks
     * @param {number} acc 
     * @param {number} difficulty 
     * @returns 
     */
    getrks(acc, difficulty) {
        if (acc == 100) {
            /**满分原曲定数即为有效rks */
            return Number(difficulty)
        } else if (acc < 70) {
            /**无效acc */
            return 0
        } else {
            /**非满分计算公式 [(((acc - 55) / 45) ^ 2) * 原曲定数] */
            return difficulty * (((acc - 55) / 45) * ((acc - 55) / 45))
        }
    }

    /**
     * 计算所需acc
     * @param {Number} rks 目标rks
     * @param {Number} difficulty 定数
     * @param {Number} [count=undefined] 保留位数
     * @returns 所需acc
     */
    comsuggest(rks, difficulty, count = undefined) {
        let ans = 45 * Math.sqrt(rks / difficulty) + 55

        if (ans >= 100)
            return "无法推分"
        else {
            if (count != undefined) {
                return `${ans.toFixed(count)}%`
            } else {
                return ans
            }
        }
    }

    /**
     * 根据原曲曲名获取结构化的曲目信息
     * @param {string} song 原曲曲名
     * @param {boolean} [ori=false] 是否只启用原版
     */
    init_info(song, ori = false) {
        if (ori) {
            return new SongsInfo(this.ori_info[song])
        } else {
            return new SongsInfo(this.info(song))
        }
    }

    /**
     * 结构化存档数组
     * @param {Array} Record 单曲存档数组
     */
    init_Record(Record, id) {
        for (let i in Record) {
            Record[i] = new LevelRecord(Record[i], id, this.Level[i])
        }
    }

}

let get = new getdata()
await get.init()
export default get


/**
 * 处理新成绩
 * @param {Object} pluginData
 * @param {EZ|HD|IN|AT|LEGACY} level 
 * @param {String} id 曲目id
 * @param {LevelRecord} nowRecord 当前成绩
 * @param {LevelRecord} oldRecord 旧成绩
 * @param {Date} new_date 新存档时间
 * @param {Date} old_date 旧存档时间
 */
function add_new_score(pluginData, level, songsid, nowRecord, oldRecord, new_date, old_date) {


    if (!pluginData.scoreHistory) {
        pluginData.scoreHistory = {}
    }
    let song = get.idgetsong(songsid)
    if (!pluginData.scoreHistory[songsid]) {
        pluginData.scoreHistory[songsid] = {}
        if (oldRecord) {
            pluginData.scoreHistory[songsid][level] = [scoreHistory.create(oldRecord.acc, oldRecord.score, old_date, oldRecord.fc)]
        }
    }
    if (!pluginData.scoreHistory[songsid][level]) {
        pluginData.scoreHistory[songsid][level] = []
    }
    pluginData.scoreHistory[songsid][level].push(scoreHistory.create(nowRecord.acc, nowRecord.score, new_date, nowRecord.fc))

    let task
    if (pluginData.plugin_data) {
        task = pluginData.plugin_data.task
    }
    let add_money = 0
    if (task) {
        for (let i in task) {
            if (!task[i]) continue
            if (!task[i].finished && song == task[i].song && level == task[i].request.rank) {
                let isfinished = false
                let reward = 0
                switch (task[i].request.type) {
                    case 'acc': {
                        if (nowRecord.acc >= task[i].request.value) {
                            isfinished = true
                            pluginData.plugin_data.task[i].finished = true
                            pluginData.plugin_data.money += task[i].reward
                            add_money += task[i].reward
                            reward = task[i].reward
                        }
                        break
                    }
                    case 'score': {
                        if (nowRecord.score >= task[i].request.value) {
                            isfinished = true
                            pluginData.plugin_data.task[i].finished = true
                            pluginData.plugin_data.money += task[i].reward
                            add_money += task[i].reward
                            reward = task[i].reward
                        }
                        break
                    }
                }
            }
        }
    }
    return add_money
}

# JavaScript 文件目录

这个目录包含了所有的JavaScript文件和相关的source map文件。

## 文件列表

### 核心JavaScript文件
- **main.js** - 主要的应用逻辑，包含视频播放、右键菜单、线路切换等功能
- **ZLMRTCClient.js** - ZLMediaKit的WebRTC客户端库
- **mpegts-1.7.3.min.js** - MPEG-TS流播放库，用于TS协议播放

### Source Map文件
- **ZLMRTCClient.js.map** - ZLMRTCClient.js的source map文件
- **mpegts.js.map** - mpegts库的source map文件

## 文件组织说明

为了更好地组织项目结构，所有的JavaScript文件都被移动到了这个`js`子目录中。

### 更新的引用路径
HTML文件中的JavaScript引用已经更新为：
```html
<script src="./js/main.js"></script>
<script src="./js/ZLMRTCClient.js"></script>
<script type="text/javascript" src="js/mpegts-1.7.3.min.js"></script>
```

### 目录结构
```
www/webrtc/
├── index.html
├── style.css
├── icons/
│   └── (各种SVG图标文件)
└── js/
    ├── main.js
    ├── ZLMRTCClient.js
    ├── ZLMRTCClient.js.map
    ├── mpegts-1.7.3.min.js
    └── mpegts.js.map
```

## 注意事项

1. 所有HTML文件中的JavaScript引用路径都已经更新
2. 功能保持不变，只是文件位置发生了变化
3. Source map文件有助于调试，建议保留

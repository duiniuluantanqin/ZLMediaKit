// VConsole will be exported to `window.VConsole` by default.
// var vConsole = new window.VConsole();

var players = [null, null, null, null, null, null, null, null, null];
var currentUrls = [null, null, null, null, null, null, null, null, null]; // 存储每个视频窗口当前播放的URL
var currentRouteTypes = ['route1', 'route1', 'route1', 'route1', 'route1', 'route1', 'route1', 'route1', 'route1']; // 存储每个视频窗口的线路类型
var recvOnly = true;
var resArr = [];
var currentLayout = '3x3';

var isLocal = "file:" === document.location.protocol;

const searchParams = new URL(document.location.href).searchParams;
let type = searchParams.get('type');
if (!['echo', 'push', 'play'].includes(type)) {
  type = 'play';
}
recvOnly = type === 'play';
const apiPath = `/index/api/webrtc?app=${searchParams.get('app') ?? 'live'}&stream=${searchParams.get('stream') ?? 'test'}&type=${type}`;

///////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * 将WebRTC URL转换为TS URL
 * @param {string} webrtcUrl - WebRTC URL，格式如：http://10.167.28.26/index/api/webrtc?app=live&stream=test&type=play
 * @returns {string} TS URL，格式如：ws://10.167.28.26/live/test.live.flv
 */
function convertToTSUrl(webrtcUrl) {
  try {
    const url = new URL(webrtcUrl);
    const params = new URLSearchParams(url.search);

    // 获取app和stream参数
    const app = params.get('app') || 'live';
    const stream = params.get('stream') || 'test';

    // 构建TS URL：将http改为ws，拼接app和stream，最后加上.live.flv
    const tsUrl = `ws://${url.host}/${app}/${stream}.live.ts`;

    return tsUrl;
  } catch (error) {
    console.error('URL转换失败:', error);
    // 如果转换失败，返回一个默认的TS URL
    return 'ws://10.167.28.26/live/test.live.flv';
  }
}

// 指示器状态常量
const INDICATOR_STATES = {
  LOADING: '正在加载视频...',
  HIDDEN: null
};

/**
 * 显示指示器
 * @param {number} index - 视频窗口索引
 * @param {string} state - 指示器状态 (LOADING)
 */
function showIndicator(index, state = INDICATOR_STATES.LOADING) {
  const loadingElement = document.getElementById(`loading${index}`);
  if (loadingElement) {
    const textElement = loadingElement.querySelector('.loading-text');
    if (textElement) {
      textElement.textContent = state;
    }
    loadingElement.classList.add('show');
    console.log(`显示指示器 - 窗口${index}: ${state}`);
  }
}

/**
 * 隐藏指示器
 * @param {number} index - 视频窗口索引
 */
function hideIndicator(index) {
  const loadingElement = document.getElementById(`loading${index}`);
  if (loadingElement) {
    loadingElement.classList.remove('show');
    console.log(`隐藏指示器 - 窗口${index}`);
  }
}

/**
 * 为video元素添加通用的加载状态检测
 * @param {number} index - 视频窗口索引
 */
function setupVideoLoadingDetection(index) {
  const videoElement = document.getElementById(`video${index}`);
  if (!videoElement) {
    console.error(`Video element with id 'video${index}' not found`);
    return;
  }

  // 移除之前可能存在的事件监听器
  videoElement.removeEventListener('loadstart', videoElement._loadstartHandler);
  videoElement.removeEventListener('loadeddata', videoElement._loadeddataHandler);
  videoElement.removeEventListener('canplay', videoElement._canplayHandler);
  videoElement.removeEventListener('playing', videoElement._playingHandler);
  videoElement.removeEventListener('error', videoElement._errorHandler);

  // 创建事件处理函数
  videoElement._loadstartHandler = function() {
    console.log(`视频开始加载 - 窗口${index}`);
    showIndicator(index, INDICATOR_STATES.LOADING);
  };

  videoElement._loadeddataHandler = function() {
    console.log(`视频数据加载完成 - 窗口${index}`);
    // 检查视频是否有实际内容，有内容就隐藏指示器
    if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
      hideIndicator(index);
    }
  };

  videoElement._canplayHandler = function() {
    console.log(`视频可以播放 - 窗口${index}`);
    // 视频可以播放时隐藏指示器
    hideIndicator(index);
  };

  videoElement._playingHandler = function() {
    console.log(`视频开始播放 - 窗口${index}`);
    // 视频开始播放时隐藏指示器
    hideIndicator(index);
  };

  videoElement._errorHandler = function(e) {
    console.error(`视频加载错误 - 窗口${index}:`, e);
    hideIndicator(index);
  };

  // 添加事件监听器
  videoElement.addEventListener('loadstart', videoElement._loadstartHandler);
  videoElement.addEventListener('loadeddata', videoElement._loadeddataHandler);
  videoElement.addEventListener('canplay', videoElement._canplayHandler);
  videoElement.addEventListener('playing', videoElement._playingHandler);
  videoElement.addEventListener('error', videoElement._errorHandler);

  console.log(`已为视频窗口${index}设置通用加载检测`);
}

// 保持向后兼容的函数名
function showLoadingIndicator(index) {
  showIndicator(index, INDICATOR_STATES.LOADING);
}

function hideLoadingIndicator(index) {
  hideIndicator(index);
}

function updateLoadingIndicatorText(index, text) {
  showIndicator(index, text);
}

/**
 * 获取指定窗口的线路类型
 * @param {number} index - 视频窗口索引
 * @returns {string} 线路类型 ('route1' 或 'route2')
 */
function getWindowRouteType(index) {
  if (index >= 0 && index < currentRouteTypes.length) {
    return currentRouteTypes[index];
  }
  return 'route1'; // 默认返回线路一
}

/**
 * 设置指定窗口的线路类型
 * @param {number} index - 视频窗口索引
 * @param {string} routeType - 线路类型 ('route1' 或 'route2')
 */
function setWindowRouteType(index, routeType) {
  if (index >= 0 && index < currentRouteTypes.length && (routeType === 'route1' || routeType === 'route2')) {
    currentRouteTypes[index] = routeType;
    console.log(`设置窗口${index}线路类型为: ${routeType}`);

    // 如果是当前选中的窗口，更新右键菜单的对号显示
    if (index === currentVideoIndex) {
      updateRouteCheckMarks();
    }
  }
}

function start(paramObj) {
  // 如果传入的是字符串，尝试解析为JSON
  if (typeof paramObj === 'string') {
    try {
      paramObj = JSON.parse(paramObj);
    } catch (e) {
      console.error('无法解析JSON字符串:', e.message);
      return;
    }
  }

  if (typeof paramObj !== 'object' || paramObj === null || Array.isArray(paramObj)) {
    console.error('start参数必须为JSON对象或JSON字符串，格式为 {"index": 0, "url": "https://example.com/path"}');
    return;
  }

  // 检查必需的属性
  if (!paramObj.hasOwnProperty('index') || !paramObj.hasOwnProperty('url')) {
    console.error('参数对象必须包含 index 和 url 属性');
    return;
  }

  var index = paramObj.index;
  var url = paramObj.url;

  if (index === undefined || index === null || index < 0 || index > 8) {
    console.error('index参数无效，必须在0-8之间');
    return;
  }

  stop(index);

  if (!url) {
    alert('请传入URL');
    return;
  }

  // 设置通用的视频加载检测
  setupVideoLoadingDetection(index);

  // 显示加载指示器
  showLoadingIndicator(index);

  // 保存当前播放的URL
  currentUrls[index] = url;

  console.log(`开始播放 - 窗口${index}: ${url}`);

  // 根据当前窗口选择的线路决定播放方式
  if (currentRouteTypes[index] === 'route2') {
    // 线路二：使用 TS 协议播放
    const tsUrl = convertToTSUrl(url);
    console.log(`线路二播放，转换URL: ${url} -> ${tsUrl}`);
    start_play_ts_stream(index, tsUrl, paramObj);
  } else {
    // 线路一：使用 WebRTC 协议播放（默认）
    console.log(`线路一播放，使用WebRTC协议: ${url}`);
    start_play_webrtc(index, url);
  }
}

/**
 * 使用 TS 协议播放视频流
 * @param {number} index - 视频窗口索引
 * @param {string} url - TS 流地址
 * @param {Object} options - 播放选项
 */
function start_play_ts_stream(index, url, options = {}) {
  const videoElement = document.getElementById(`video${index}`);
  if (!videoElement) {
    console.error(`Video element with id 'video${index}' not found`);
    return;
  }

  console.log(`开始播放 TS 流 - 窗口${index}: ${url}`);

  // 停止之前的播放器
  if (players[index]) {
    players[index].close();
    players[index] = null;
  }

  try {
    // 创建 TS 播放器
    const tsController = start_play_ts(url, {
      videoElement: videoElement,
      isLive: options.isLive !== false, // 默认为直播流
      enableStashBuffer: options.enableStashBuffer || false,
      onSuccess: (player) => {
        console.log(`TS 播放成功 - 窗口${index}`);

        // 设置视频音量
        setTimeout(() => {
          setVideoVolume(videoElement);
        }, 100);

        // 通知 WPF 程序播放成功
        notifyWpfTSPlaySuccess(index, url);
      },
      onError: (error) => {
        console.error(`TS 播放失败 - 窗口${index}:`, error.message);

        // 隐藏加载指示器（错误情况下仍需要隐藏）
        hideLoadingIndicator(index);

        // 通知 WPF 程序播放失败
        notifyWpfTSPlayError(index, error.message);
        
        // 可以在这里添加重试逻辑
        // setTimeout(() => {
        //   console.log(`尝试重新播放 TS 流 - 窗口${index}`);
        //   start_play_ts_stream(index, url, options);
        // }, 3000);
      },
      onDestroy: () => {
        console.log(`TS 播放器已销毁 - 窗口${index}`);
        players[index] = null;
        notifyWpfClose(index);
      }
    });

    // 将 TS 控制器保存到 players 数组中
    players[index] = tsController;
    
    console.log(`TS 播放器创建完成 - 窗口${index}`);

  } catch (error) {
    console.error(`创建 TS 播放器失败 - 窗口${index}:`, error);
    alert(`创建 TS 播放器失败: ${error.message}`);
  }
}

/**
 * 使用 WebRTC 协议播放视频流（原有代码）
 * @param {number} index - 视频窗口索引
 * @param {string} url - WebRTC 流地址
 */
function start_play_webrtc(index, url) {
  const videoElement = document.getElementById(`video${index}`);
  if (!videoElement) {
    console.error(`Video element with id 'video${index}' not found`);
    return;
  }

  console.log(`开始播放 WebRTC 流 - 窗口${index}: ${url}`);

  // 检查摄像头支持（原有逻辑）
  if (document.getElementById('useCamera') && document.getElementById('useCamera').checked && !recvOnly) {
    ZLMRTCClient.isSupportResolution(1920, 1080).then(e => {
      start_play_webrtc_internal(index, url);
    }).catch(e => {
      alert("not support resolution");
    });
  } else {
    start_play_webrtc_internal(index, url);
  }
}

/**
 * WebRTC 播放的内部实现（原 start_play 函数的内容）
 * @param {number} index - 视频窗口索引
 * @param {string} url - WebRTC 流地址
 */
function start_play_webrtc_internal(index, url) {
  const videoElement = document.getElementById(`video${index}`);
  if (!videoElement) {
    console.error(`Video element with id 'video${index}' not found`);
    return;
  }

  players[index] = new ZLMRTCClient.Endpoint(
    {
      element: videoElement,// video 标签
      debug: true,// 是否打印日志
      zlmsdpUrl: url,//流地址
      simulcast: false,
      useCamera: true,
      audioEnable: true,
      videoEnable: true,
      recvOnly: recvOnly,
      resolution: { w: 1280, h: 720 },
      usedatachannel: false,
      videoId: '', // 不填选择默认的
      audioId: '', // 不填选择默认的
    }
  );

  players[index].on(ZLMRTCClient.Events.WEBRTC_ICE_CANDIDATE_ERROR, function (e) {
    // ICE 协商出错
    console.log(`ICE 协商出错 - 窗口${index}`);
  });

  players[index].on(ZLMRTCClient.Events.WEBRTC_ON_REMOTE_STREAMS, function (s) {
    //获取到了远端流，可以播放,如果element 为null 或者不传,可以在这里播放(如下注释代码)
    /*
      document.getElementById('video').srcObject=s;
    */
    console.log(`播放成功 - 窗口${index}`, s);

    // 设置视频音量
    setTimeout(() => {
      setVideoVolume(videoElement);
    }, 100);
  });

  players[index].on(ZLMRTCClient.Events.WEBRTC_OFFER_ANWSER_EXCHANGE_FAILED, function (e) {
    // offer anwser 交换失败
    console.log(`offer anwser 交换失败 - 窗口${index}`, e);
    // 隐藏加载指示器（错误情况下仍需要隐藏）
    hideLoadingIndicator(index);
    stop(index);
  });

  players[index].on(ZLMRTCClient.Events.WEBRTC_ON_LOCAL_STREAM, function (s) {
    // 获取到了本地流 
    console.log(`获取到本地流 - 窗口${index}`, s);
  });

  players[index].on(ZLMRTCClient.Events.CAPTURE_STREAM_FAILED, function (s) {
    // 获取本地流失败
    console.log(`获取本地流失败 - 窗口${index}`);
  });

  players[index].on(ZLMRTCClient.Events.WEBRTC_ON_CONNECTION_STATE_CHANGE, function (state) {
    // RTC 状态变化 ,详情参考 https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionState
    console.log(`当前状态 - 窗口${index} ==>`, state);
  });

  // 监听解码信息回调
  players[index].on(ZLMRTCClient.Events.WEBRTC_ON_DECODE_INFO, function (decodeInfo) {
    const logData = {
      编解码器: decodeInfo.codecName,
      解码器实现: decodeInfo.decoderImplementation,
      视频尺寸: `${decodeInfo.frameWidth}x${decodeInfo.frameHeight}`,
      帧率: decodeInfo.framesPerSecond,
      已解码帧数: decodeInfo.framesDecoded,
      丢帧数: decodeInfo.framesDropped,
      关键帧数: decodeInfo.keyFramesDecoded
    };
    console.log(`解码信息 - 窗口${index}:`, logData);

    // 更新视频窗口内的统计信息显示
    updateVideoStats(index, 'decode', decodeInfo);
  });

  // 监听码率信息回调
  players[index].on(ZLMRTCClient.Events.WEBRTC_ON_BITRATE_INFO, function (bitrateInfo) {
    const logData = {
      视频码率: `${(bitrateInfo.videoBitrate / 1000).toFixed(1)} kbps`,
      包速率: `${bitrateInfo.videoPacketRate} pps`,
      丢包数: bitrateInfo.packetsLost,
      丢包率: `${bitrateInfo.packetLossRate}%`,
      网络抖动: `${bitrateInfo.jitter} ms`,
      往返时延: `${bitrateInfo.roundTripTime} ms`
    };
    console.log(`码率信息 - 窗口${index}:`, logData);

    // 更新视频窗口内的统计信息显示
    updateVideoStats(index, 'bitrate', bitrateInfo);
  });
}

// 通知 WPF 程序 TS 播放成功
function notifyWpfTSPlaySuccess(index, url) {
  notifyWpf('tsPlaySuccess', index, { url: url });
}

// 通知 WPF 程序 TS 播放失败
function notifyWpfTSPlayError(index, errorMessage) {
  notifyWpf('tsPlayError', index, { error: errorMessage });
}

function stop(index) {
  if (index !== undefined && index !== null && index >= 0 && index <= 8 && players[index]) {
    const player = players[index];

    // 检查是否为 TS 播放器（有 destroy 方法）
    if (typeof player.destroy === 'function') {
      // TS 播放器
      console.log(`停止 TS 播放器 - 窗口${index}`);
      player.destroy();
    } else {
      // WebRTC 播放器
      console.log(`停止 WebRTC 播放器 - 窗口${index}`);
      player.close();
    }

    players[index] = null;
    currentUrls[index] = null; // 清除保存的URL
    // 注意：不清除线路类型设置，保持用户的选择
    var remote = document.getElementById(`video${index}`);
    if (remote) {
      remote.srcObject = null;
      remote.load();
    }
    notifyWpfClose(index);
    console.log(`停止播放 - 窗口${index}`);
  }

  // 隐藏加载指示器（无论是否有播放器）
  hideLoadingIndicator(index);

  // 注意：不再自动隐藏统计信息显示，保持用户的选择状态
}

function startRecord(paramObj) {
  // 如果传入的是字符串，尝试解析为JSON
  if (typeof paramObj === 'string') {
    try {
      paramObj = JSON.parse(paramObj);
    } catch (e) {
      console.error('无法解析JSON字符串:', e.message);
      return;
    }
  }

  if (typeof paramObj !== 'object' || paramObj === null || Array.isArray(paramObj)) {
    console.error('start参数必须为JSON对象或JSON字符串，格式为 {"index": 0, "path": "c:\\record.mp4"}');
    return;
  }

  // 检查必需的属性
  if (!paramObj.hasOwnProperty('index') || !paramObj.hasOwnProperty('path')) {
    console.error('参数对象必须包含 index 和 path 属性');
    return;
  }

  var index = paramObj.index;
  var path = paramObj.path;

  if (index === undefined || index === null || index < 0 || index > 8) {
    console.error('index参数无效，必须在0-8之间');
    return;
  }

  startRecordingInternal(index, path);
}

function switchLayout(paramObj) {
  // 如果传入的是字符串，尝试解析为JSON
  if (typeof paramObj === 'string') {
    try {
      paramObj = JSON.parse(paramObj);
    } catch (e) {
      console.error('无法解析JSON字符串:', e.message);
      return;
    }
  }

  if (typeof paramObj !== 'object' || paramObj === null || Array.isArray(paramObj)) {
    console.error('switchLayoutExternal参数必须为JSON对象或JSON字符串，格式为 {"layout": "1"}');
    return;
  }

  // 检查必需的属性
  if (!paramObj.hasOwnProperty('layout')) {
    console.error('参数对象必须包含 layout 属性');
    return;
  }

  var layout = paramObj.layout;

  if (layout === undefined || layout === null) {
    console.error('layout参数无效，不能为空');
    return;
  }

  // 验证布局参数
  if (!['1', '4', '9'].includes(layout)) {
    console.error('layout参数无效，必须是 "1"、"4" 或 "9" 之一');
    return;
  }

  // 调用内部切换布局函数
  switchLayoutInternal(layout);
  console.log(`外部调用切换布局成功 - 布局: ${layout}`);
}


///////////////////////////////////////////////////////////////////////////////////////////////////////

function switchLayoutInternal(layout) {
  const videoGrid = document.getElementById('videoGrid');
  const icons = document.querySelectorAll('.layout-icon');

  // 移除所有布局类
  videoGrid.classList.remove('layout-1x1', 'layout-2x2', 'layout-3x3');

  // 根据传入的layout参数添加对应的布局类
  if (layout === '1') {
    videoGrid.classList.add('layout-1x1');
  } else if (layout === '4') {
    videoGrid.classList.add('layout-2x2');
  } else if (layout === '9') {
    videoGrid.classList.add('layout-3x3');
  }

  // 更新图标状态 - 移除所有active类，然后根据layout参数设置对应的图标为active
  icons.forEach(icon => icon.classList.remove('active'));

  // 根据layout参数找到对应的图标并设置为active
  if (layout === '1') {
    const icon1 = document.querySelector('.layout-icon[onclick="switchLayoutInternal(\'1\')"]');
    if (icon1) icon1.classList.add('active');
  } else if (layout === '4') {
    const icon4 = document.querySelector('.layout-icon[onclick="switchLayoutInternal(\'4\')"]');
    if (icon4) icon4.classList.add('active');
  } else if (layout === '9') {
    const icon9 = document.querySelector('.layout-icon[onclick="switchLayoutInternal(\'9\')"]');
    if (icon9) icon9.classList.add('active');
  }

  // 显示/隐藏视频容器
  const containers = document.querySelectorAll('.video-container');

  // 先隐藏所有容器
  containers.forEach(container => {
    container.classList.add('hidden');
  });

  // 根据布局显示对应数量的容器
  if (layout === '1') {
    containers[0].classList.remove('hidden');
  } else if (layout === '4') {
    containers[0].classList.remove('hidden');
    containers[1].classList.remove('hidden');
    containers[2].classList.remove('hidden');
    containers[3].classList.remove('hidden');
  } else if (layout === '9') {
    containers.forEach(container => {
      container.classList.remove('hidden');
    });
  }

  currentLayout = layout;
  console.log(`切换到${layout}布局`);
}

function start_play(index, url) {
  const videoElement = document.getElementById(`video${index}`);
  if (!videoElement) {
    console.error(`Video element with id 'video${index}' not found`);
    return;
  }

  players[index] = new ZLMRTCClient.Endpoint(
    {
      element: videoElement,// video 标签
      debug: true,// 是否打印日志
      zlmsdpUrl: url,//流地址
      simulcast: false,
      useCamera: true,
      audioEnable: true,
      videoEnable: true,
      recvOnly: recvOnly,
      resolution: { w: 1280, h: 720 },
      usedatachannel: false,
      videoId: '', // 不填选择默认的
      audioId: '', // 不填选择默认的
    }
  );

  players[index].on(ZLMRTCClient.Events.WEBRTC_ICE_CANDIDATE_ERROR, function (e) {
    // ICE 协商出错
    console.log(`ICE 协商出错 - 窗口${index}`);
  });

  players[index].on(ZLMRTCClient.Events.WEBRTC_ON_REMOTE_STREAMS, function (s) {
    //获取到了远端流，可以播放,如果element 为null 或者不传,可以在这里播放(如下注释代码)
    /*
      document.getElementById('video').srcObject=s;
    */
    console.log(`播放成功 - 窗口${index}`, s);

    // 设置视频音量
    setTimeout(() => {
      setVideoVolume(videoElement);
    }, 100);
  });

  players[index].on(ZLMRTCClient.Events.WEBRTC_OFFER_ANWSER_EXCHANGE_FAILED, function (e) {
    // offer anwser 交换失败
    console.log(`offer anwser 交换失败 - 窗口${index}`, e);
    // 隐藏加载指示器（错误情况下仍需要隐藏）
    hideLoadingIndicator(index);
    stop(index);
  });

  players[index].on(ZLMRTCClient.Events.WEBRTC_ON_LOCAL_STREAM, function (s) {
    // 获取到了本地流 
    console.log(`获取到本地流 - 窗口${index}`, s);
  });

  players[index].on(ZLMRTCClient.Events.CAPTURE_STREAM_FAILED, function (s) {
    // 获取本地流失败
    console.log(`获取本地流失败 - 窗口${index}`);
  });

  players[index].on(ZLMRTCClient.Events.WEBRTC_ON_CONNECTION_STATE_CHANGE, function (state) {
    // RTC 状态变化 ,详情参考 https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionState
    console.log(`当前状态 - 窗口${index} ==>`, state);
  });

  players[index].on(ZLMRTCClient.Events.WEBRTC_ON_DATA_CHANNEL_OPEN, function (event) {
    console.log(`rtc datachannel 打开 - 窗口${index}:`, event);
  });

  players[index].on(ZLMRTCClient.Events.WEBRTC_ON_DATA_CHANNEL_MSG, function (event) {
    console.log(`rtc datachannel 消息 - 窗口${index}:`, event.data);
  });
  players[index].on(ZLMRTCClient.Events.WEBRTC_ON_DATA_CHANNEL_ERR, function (event) {
    console.log(`rtc datachannel 错误 - 窗口${index}:`, event);
  });
  players[index].on(ZLMRTCClient.Events.WEBRTC_ON_DATA_CHANNEL_CLOSE, function (event) {
    console.log(`rtc datachannel 关闭 - 窗口${index}:`, event);
  });

  // 监听解码信息回调
  players[index].on(ZLMRTCClient.Events.WEBRTC_ON_DECODE_INFO, function (decodeInfo) {
    const logData = {
      编解码器: decodeInfo.codecName,
      解码器实现: decodeInfo.decoderImplementation,
      视频尺寸: `${decodeInfo.frameWidth}x${decodeInfo.frameHeight}`,
      帧率: decodeInfo.framesPerSecond,
      已解码帧数: decodeInfo.framesDecoded,
      丢帧数: decodeInfo.framesDropped,
      关键帧数: decodeInfo.keyFramesDecoded
    };
    console.log(`解码信息 - 窗口${index}:`, logData);

    // 更新视频窗口内的统计信息显示
    updateVideoStats(index, 'decode', decodeInfo);
  });

  // 监听码率信息回调
  players[index].on(ZLMRTCClient.Events.WEBRTC_ON_BITRATE_INFO, function (bitrateInfo) {
    const logData = {
      视频码率: `${(bitrateInfo.videoBitrate / 1000).toFixed(1)} kbps`,
      包速率: `${bitrateInfo.videoPacketRate} pps`,
      丢包数: bitrateInfo.packetsLost,
      丢包率: `${bitrateInfo.packetLossRate}%`,
      网络抖动: `${bitrateInfo.jitter} ms`,
      往返时延: `${bitrateInfo.roundTripTime} ms`
    };
    console.log(`码率信息 - 窗口${index}:`, logData);

    // 更新视频窗口内的统计信息显示
    updateVideoStats(index, 'bitrate', bitrateInfo);
  });
}

function toggleFullscreen() {
  hideContextMenu();
  const grid = document.getElementById('videoGrid');
  if (!document.fullscreenElement) {
    if (grid.requestFullscreen) {
      grid.requestFullscreen();
    } else if (grid.webkitRequestFullscreen) {
      grid.webkitRequestFullscreen();
    } else if (grid.mozRequestFullScreen) {
      grid.mozRequestFullScreen();
    } else if (grid.msRequestFullscreen) {
      grid.msRequestFullscreen();
    }
    notifyWpfFullscreen(-1);
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
    notifyWpfExitFullscreen(-1);
  }
}

// 视频控制功能
function toggleMute(index) {
  // 先选中这个视频窗口
  selectVideo(index);

  const video = document.getElementById(`video${index}`);
  const muteBtn = document.querySelector(`.video-container:nth-child(${index + 1}) .control-btn[onclick="toggleMute(${index})"]`);

  if (video) {
    if (!video.muted) {
      // 当前未静音，要进行静音操作
      // 保存当前音量级别
      previousVolumeLevel = Math.round(video.volume * 15);
      if (previousVolumeLevel === 0) {
        previousVolumeLevel = 8; // 如果当前音量为0，设置默认值
      }

      video.muted = true;
      video.volume = 0;
      muteBtn.innerHTML = getSVGIcon('volume-off');
      muteBtn.classList.add('muted');
      muteBtn.title = '取消静音';

      // 更新全局状态
      isMuted = true;
      currentVolumeLevel = 0;
    } else {
      // 当前已静音，要取消静音
      // 恢复之前保存的音量
      const restoreVolume = previousVolumeLevel > 0 ? previousVolumeLevel : 8;

      video.muted = false;
      video.volume = restoreVolume / 15;
      muteBtn.innerHTML = getSVGIcon('volume-on');
      muteBtn.classList.remove('muted');
      muteBtn.title = '静音';

      // 更新全局状态
      isMuted = false;
      currentVolumeLevel = restoreVolume;
    }

    // 更新音量条显示和图标
    updateVolumeBars();
    updateVolumeIcon();

    console.log(`视频${index} ${video.muted ? '已静音' : '已取消静音'}, 音量级别: ${currentVolumeLevel}`);
  }
}

function captureFrame(index) {
  const video = document.getElementById(`video${index}`);
  if (video && video.videoWidth > 0 && video.videoHeight > 0) {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 创建下载链接
    canvas.toBlob(function (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video${index}_capture_${new Date().getTime()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log(`视频${index} 截图已保存`);
    }, 'image/png');
  } else {
    console.log(`视频${index} 无法截图：视频未加载或无内容`);
    alert('视频未加载完成，无法截图');
  }
}

function closeVideo(index) {
  stop(index);
}

// 悬浮控制框的录像切换功能
function toggleVideoRecording(index) {
  // 如果当前有其他窗口在录像，先停止
  if (isRecording && recordingVideoIndex !== index) {
    stopRecording();
    // 等待一下再开始新的录像
    setTimeout(() => {
      startVideoRecording(index);
    }, 100);
  } else if (isRecording && recordingVideoIndex === index) {
    // 如果当前窗口正在录像，则停止录像
    stopRecording();
  } else {
    // 开始录像
    startVideoRecording(index);
  }
}

function startVideoRecording(index) {
  // 设置当前视频索引，然后通知WPF程序开始录像
  currentVideoIndex = index;
  notifyWpfStartRecording(index);

  // 更新悬浮控制框按钮状态
  updateRecordingButton(index);
}

// 更新悬浮控制框录像按钮的状态
function updateRecordingButton(index) {
  const recordBtn = document.querySelector(`.video-container:nth-child(${index + 1}) .control-btn[onclick="toggleVideoRecording(${index})"]`);

  if (recordBtn) {
    if (isRecording && recordingVideoIndex === index) {
      recordBtn.innerHTML = getSVGIcon('stop');
      recordBtn.title = '停止录像';
      recordBtn.classList.add('recording');
    } else {
      recordBtn.innerHTML = getSVGIcon('record');
      recordBtn.title = '开始录像';
      recordBtn.classList.remove('recording');
    }
  }
}

// 更新所有悬浮控制框录像按钮的状态
function updateAllRecordingButtons() {
  for (let i = 0; i < 9; i++) {
    updateRecordingButton(i);
  }
}

// 右键菜单相关变量
let currentVideoIndex = -1;
let continuousCaptureInterval = null;
let isContinuousCapturing = false;
let captureCount = 0;
let selectedVideoIndex = -1;
let currentStreamType = 'main'; // 'main' 或 'sub'，默认为主码流
let videoStatsVisible = [false, false, false, false, false, false, false, false, false]; // 每个视频窗口的统计信息显示状态

// SVG图标生成函数
function getSVGIcon(type) {
  const icons = {
    'volume-on': '<img class="icon-svg" src="./icons/volume-on.svg" alt="音量开启">',
    'volume-off': '<img class="icon-svg" src="./icons/volume-off.svg" alt="音量关闭">',
    'record': '<img class="icon-svg" src="./icons/record.svg" alt="录像">',
    'stop': '<img class="icon-svg" src="./icons/stop.svg" alt="停止">',
    'camera': '<img class="icon-svg" src="./icons/camera.svg" alt="拍照">',
    'close': '<img class="icon-svg" src="./icons/close.svg" alt="关闭">',
    'fullscreen': '<img class="icon-svg" src="./icons/fullscreen.svg" alt="全屏">',
    'layout-1x1': '<img class="icon-svg" src="./icons/layout-1x1.svg" alt="1×1 布局">',
    'layout-2x2': '<img class="icon-svg" src="./icons/layout-2x2.svg" alt="2×2 布局">',
    'layout-3x3': '<img class="icon-svg" src="./icons/layout-3x3.svg" alt="3×3 布局">',
    'arrow-right': '<img class="icon-svg" src="./icons/arrow-right.svg" alt="右箭头">'
  };
  return icons[type] || '';
}


// 右键菜单功能函数
function startPlayCurrentVideo() {
  hideContextMenu();

  if (currentVideoIndex >= 0) {
    // 使用默认的测试URL
    const defaultUrl = 'http://10.167.28.26/index/api/webrtc?app=live&stream=35fc0438-6561-4f3f-8a4d-19fae318d030&type=play';

    console.log(`开始播放测试流 - 视频${currentVideoIndex}`);
    console.log(`使用URL: ${defaultUrl}`);

    // 调用start函数开始播放
    start({
      index: currentVideoIndex,
      url: defaultUrl
    });

    // 显示提示信息
    console.log(`已发送播放命令到视频窗口 ${currentVideoIndex}`);
  } else {
    console.log('没有选中的视频窗口');
  }
}

function closeCurrentVideo() {
  hideContextMenu();

  if (currentVideoIndex >= 0) {
    closeVideo(currentVideoIndex);
  }
}

function closeAllVideos() {
  hideContextMenu();

  // 弹出确认对话框
  if (confirm('确定要关闭所有视频窗口吗？\n\n此操作将关闭全部9个视频窗口，无法撤销。')) {
    for (let i = 0; i < 9; i++) {
      stop(i);
    }
    console.log('已关闭所有视频窗口');
  } else {
    console.log('用户取消了关闭所有窗口的操作');
  }
}

function captureCurrentFrame() {
  hideContextMenu();
  if (currentVideoIndex >= 0) {
    captureFrame(currentVideoIndex);
  }

}

function toggleContinuousCapture() {
  if (currentVideoIndex < 0) {
    hideContextMenu();
    return;
  }

  // 通过onclick属性找到连续抓图菜单项
  const menuItems = document.querySelectorAll('.context-menu-item');
  let menuItem = null;
  menuItems.forEach(item => {
    if (item.getAttribute('onclick') === 'toggleContinuousCapture()') {
      menuItem = item;
    }
  });

  if (!isContinuousCapturing) {
    // 开始连续抓图
    captureCount = 0;
    isContinuousCapturing = true;
    menuItem.innerHTML = getSVGIcon('stop') + '停止连续抓图';
    console.log(`开始连续抓图 - 视频${currentVideoIndex} (共5次)`);

    // 立即抓第一张图
    captureFrame(currentVideoIndex);
    captureCount++;

    // 设置定时器抓剩余4张图
    continuousCaptureInterval = setInterval(() => {
      if (captureCount < 5) {
        captureFrame(currentVideoIndex);
        captureCount++;
        console.log(`连续抓图进度: ${captureCount}/5 - 视频${currentVideoIndex}`);
      } else {
        // 抓满5张后自动停止
        stopContinuousCapture();
      }
    }, 1000); // 每秒抓一张图

  } else {
    // 手动停止连续抓图
    stopContinuousCapture();
  }

  hideContextMenu();
}

function stopContinuousCapture() {
  if (continuousCaptureInterval) {
    clearInterval(continuousCaptureInterval);
    continuousCaptureInterval = null;
  }

  isContinuousCapturing = false;
  // 通过onclick属性找到连续抓图菜单项
  const menuItems = document.querySelectorAll('.context-menu-item');
  let menuItem = null;
  menuItems.forEach(item => {
    if (item.getAttribute('onclick') === 'toggleContinuousCapture()') {
      menuItem = item;
    }
  });
  if (menuItem) {
    menuItem.innerHTML = getSVGIcon('record') + '连续抓图';
  }

  console.log(`连续抓图完成 - 视频${currentVideoIndex} (共抓取${captureCount}张)`);
  captureCount = 0;
}

// 录像相关功能
let isRecording = false; // 录像状态
let recordingVideoIndex = -1; // 正在录像的视频索引
let mediaRecorder = null; // MediaRecorder实例
let recordedChunks = []; // 录制的数据块
let recordingStartTime = null; // 录像开始时间
let recordingTimer = null; // 录像计时器
let recordingPath = null; // 录像保存路径

function toggleRecording() {
  hideContextMenu();

  if (currentVideoIndex < 0) {
    console.log('没有选中的视频窗口');
    return;
  }

  if (!isRecording) {
    // 通知WPF程序开始录像
    notifyWpfStartRecording(currentVideoIndex);
  } else {
    // 停止录像
    stopRecording();
  }
}

// 内部录像函数，带有path参数
function startRecordingInternal(videoIndex, path) {
  const videoElement = document.getElementById(`video${videoIndex}`);

  if (!videoElement || !videoElement.srcObject) {
    console.error(`视频${videoIndex} 没有可录制的流`);
    alert('该视频窗口没有可录制的内容');
    return;
  }

  // 检查浏览器是否支持MediaRecorder
  if (!window.MediaRecorder) {
    console.error('浏览器不支持MediaRecorder API');
    alert('您的浏览器不支持录像功能');
    return;
  }

  try {
    // 获取视频流
    const stream = videoElement.srcObject;

    // 检查支持的MIME类型
    let mimeType = 'video/webm;codecs=vp9'; // 默认使用WebM格式
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      mimeType = 'video/webm;codecs=vp8';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      mimeType = 'video/webm';
    }

    // 创建MediaRecorder实例
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: 2500000 // 2.5Mbps
    });

    // 重置录制数据
    recordedChunks = [];
    recordingStartTime = new Date();
    recordingPath = path; // 保存录像路径

    // 设置事件监听器
    mediaRecorder.ondataavailable = function (event) {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
        console.log(`录制数据块大小: ${event.data.size} bytes`);
      }
    };

    mediaRecorder.onstop = function () {
      console.log('录像停止，开始处理录制数据...');
      saveRecordedVideo(videoIndex, mimeType, recordingPath);
    };

    mediaRecorder.onerror = function (event) {
      console.error('录像过程中发生错误:', event.error);
      alert('录像过程中发生错误: ' + event.error.message);
      resetRecordingState();
    };

    // 开始录制
    mediaRecorder.start(1000); // 每秒收集一次数据

    isRecording = true;
    recordingVideoIndex = videoIndex;

    // 显示录像指示器
    showRecordingIndicator(videoIndex);

    // 开始录像时长计时
    startRecordingTimer(videoIndex);

    // 更新菜单项文本
    updateRecordingMenuItem();

    // 更新所有悬浮控制框按钮状态
    updateAllRecordingButtons();

    console.log(`开始录像 - 视频${videoIndex}, MIME类型: ${mimeType}, 路径: ${path}`);

  } catch (error) {
    console.error('启动录像失败:', error);
    alert('启动录像失败: ' + error.message);
    resetRecordingState();
  }
}

// 将startRecord函数暴露到window对象，供WPF程序调用
window.startRecord = startRecord;

function stopRecording() {
  if (!isRecording || !mediaRecorder) return;

  try {
    // 停止录制
    mediaRecorder.stop();
    console.log('正在停止录像...');

  } catch (error) {
    console.error('停止录像失败:', error);
    alert('停止录像失败: ' + error.message);
    resetRecordingState();
  }
}

function saveRecordedVideo(videoIndex, mimeType, path) {
  if (recordedChunks.length === 0) {
    console.warn('没有录制到任何数据');
    alert('录像文件为空，可能是录制时间太短');
    resetRecordingState();
    return;
  }

  try {
    // 创建Blob对象
    const blob = new Blob(recordedChunks, { type: mimeType });
    const url = URL.createObjectURL(blob);

    // 生成文件名
    let fileExtension = '.webm';
    if (mimeType.includes('mp4')) {
      fileExtension = '.mp4';
    }

    // 使用WPF传入的路径作为文件名
    let filename = path.endsWith(fileExtension) ? path : `${path}${fileExtension}`;

    // 创建下载链接
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 清理URL对象
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

    const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    console.log(`录像保存成功 - 视频${videoIndex}, 文件: ${filename}, 大小: ${fileSizeMB}MB`);

  } catch (error) {
    console.error('保存录像文件失败:', error);
    alert('保存录像文件失败: ' + error.message);
  } finally {
    resetRecordingState();
  }
}

function resetRecordingState() {
  // 停止录像计时器
  stopRecordingTimer();

  // 隐藏录像指示器
  if (recordingVideoIndex >= 0) {
    hideRecordingIndicator(recordingVideoIndex);
  }

  isRecording = false;
  recordingVideoIndex = -1;
  mediaRecorder = null;
  recordedChunks = [];
  recordingStartTime = null;
  recordingPath = null;

  // 更新菜单项文本
  updateRecordingMenuItem();

  // 更新所有悬浮控制框按钮状态
  updateAllRecordingButtons();
}

// 显示录像指示器
function showRecordingIndicator(videoIndex) {
  const videoContainer = document.querySelector(`.video-container:nth-child(${videoIndex + 1})`);
  if (videoContainer) {
    videoContainer.classList.add('recording');
    console.log(`显示录像指示器 - 视频${videoIndex}`);
  }
}

// 隐藏录像指示器
function hideRecordingIndicator(videoIndex) {
  const videoContainer = document.querySelector(`.video-container:nth-child(${videoIndex + 1})`);
  if (videoContainer) {
    videoContainer.classList.remove('recording');
    // 重置时长显示
    const timeDisplay = videoContainer.querySelector('.recording-time');
    if (timeDisplay) {
      timeDisplay.textContent = '00:00';
    }
    console.log(`隐藏录像指示器 - 视频${videoIndex}`);
  }
}

// 开始录像计时器
function startRecordingTimer(videoIndex) {
  // 确保之前的计时器已停止
  stopRecordingTimer();

  recordingTimer = setInterval(() => {
    updateRecordingTime(videoIndex);
  }, 1000); // 每秒更新一次

  console.log(`开始录像计时 - 视频${videoIndex}`);
}

// 停止录像计时器
function stopRecordingTimer() {
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
    console.log('录像计时器已停止');
  }
}

// 更新录像时长显示
function updateRecordingTime(videoIndex) {
  if (!recordingStartTime || recordingVideoIndex !== videoIndex) {
    return;
  }

  const currentTime = new Date();
  const elapsedSeconds = Math.floor((currentTime - recordingStartTime) / 1000);
  const formattedTime = formatRecordingTime(elapsedSeconds);

  // 更新指定视频窗口的时长显示
  const videoContainer = document.querySelector(`.video-container:nth-child(${videoIndex + 1})`);
  if (videoContainer) {
    const timeDisplay = videoContainer.querySelector('.recording-time');
    if (timeDisplay) {
      timeDisplay.textContent = formattedTime;
    }
  }
}

// 格式化录像时长 (秒数转换为 MM:SS 格式)
function formatRecordingTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  // 如果超过99分钟，显示为 99:59
  const displayMinutes = Math.min(minutes, 99);

  return `${displayMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function updateRecordingMenuItem() {
  // 由于菜单项的位置可能会变化，我们通过onclick属性来找到正确的元素
  const menuItems = document.querySelectorAll('.context-menu-item');
  let recordingMenuItem = null;

  menuItems.forEach(item => {
    if (item.getAttribute('onclick') === 'toggleRecording()') {
      recordingMenuItem = item;
    }
  });

  if (recordingMenuItem) {
    if (isRecording) {
      recordingMenuItem.innerHTML = '停止录像';
    } else {
      recordingMenuItem.innerHTML = '开始录像';
    }
  }
}

function togglePlayback() {
  hideContextMenu();
  if (currentVideoIndex >= 0) {
    console.log(`通知：回放录像${currentVideoIndex}`);
    notifyWpfPlayback(currentVideoIndex);
  }
}

function toggleMarking() {
  hideContextMenu();
  if (currentVideoIndex >= 0) {
    console.log(`通知：实时打标${currentVideoIndex}`);
    notifyWpfMarking(currentVideoIndex);
  }
}

function toggleCurrentAudio() {
  if (currentVideoIndex >= 0) {
    toggleMute(currentVideoIndex);
  }
  hideContextMenu();
}

// 二级菜单显示/隐藏函数
function showSubmenu(event) {
  const submenu = event.currentTarget.querySelector('.submenu');
  if (submenu) {
    submenu.style.display = 'block';
  }
}

function hideSubmenu(event) {
  const submenu = event.currentTarget.querySelector('.submenu');
  if (submenu) {
    submenu.style.display = 'none';
  }
}

// 切换码流功能
function switchToMainStream() {
  hideContextMenu();
  if (currentVideoIndex >= 0) {
    currentStreamType = 'main';
    updateStreamCheckMarks();
    console.log(`切换到主码流 - 视频${currentVideoIndex}`);
    // TODO: 实现切换到主码流的功能
  }
}

function switchToSubStream() {
  hideContextMenu();
  if (currentVideoIndex >= 0) {
    currentStreamType = 'sub';
    updateStreamCheckMarks();
    console.log(`切换到辅码流 - 视频${currentVideoIndex}`);
    // TODO: 实现切换到辅码流的功能
  }
}

// 更新码流选择的对号显示
function updateStreamCheckMarks() {
  const mainStreamCheck = document.getElementById('mainStreamCheck');
  const subStreamCheck = document.getElementById('subStreamCheck');

  if (currentStreamType === 'main') {
    mainStreamCheck.style.display = 'inline';
    subStreamCheck.style.display = 'none';
  } else {
    mainStreamCheck.style.display = 'none';
    subStreamCheck.style.display = 'inline';
  }
}

// 切换线路功能
function switchToRoute1() {
  hideContextMenu();
  if (currentVideoIndex >= 0) {
    currentRouteTypes[currentVideoIndex] = 'route1';
    updateRouteCheckMarks();
    console.log(`切换到线路一 (WebRTC协议) - 视频${currentVideoIndex}`);

    // 通知WPF程序切换线路事件
    notifyWpfSwitchRoute(currentVideoIndex, 'route1', 'webrtc');

    // 重新播放当前流，使用WebRTC协议
    replayCurrentStream(currentVideoIndex);
  }
}

function switchToRoute2() {
  hideContextMenu();
  if (currentVideoIndex >= 0) {
    currentRouteTypes[currentVideoIndex] = 'route2';
    updateRouteCheckMarks();
    console.log(`切换到线路二 (TS协议) - 视频${currentVideoIndex}`);

    // 通知WPF程序切换线路事件
    notifyWpfSwitchRoute(currentVideoIndex, 'route2', 'ts');

    // 重新播放当前流，使用TS协议
    replayCurrentStream(currentVideoIndex);
  }
}

// 更新线路选择的对号显示
function updateRouteCheckMarks() {
  const route1Check = document.getElementById('route1Check');
  const route2Check = document.getElementById('route2Check');

  // 根据当前选中窗口的线路类型显示对号
  if (currentVideoIndex >= 0 && currentRouteTypes[currentVideoIndex] === 'route1') {
    route1Check.style.display = 'inline';
    route2Check.style.display = 'none';
  } else if (currentVideoIndex >= 0 && currentRouteTypes[currentVideoIndex] === 'route2') {
    route1Check.style.display = 'none';
    route2Check.style.display = 'inline';
  } else {
    // 如果没有选中窗口，默认显示线路一
    route1Check.style.display = 'inline';
    route2Check.style.display = 'none';
  }
}

/**
 * 重新播放当前流（用于切换线路时）
 * @param {number} videoIndex - 视频窗口索引
 */
function replayCurrentStream(videoIndex) {
  // 获取当前视频窗口正在播放的原始URL
  const originalUrl = currentUrls[videoIndex];

  if (!originalUrl) {
    console.log(`重新播放失败 - 视频${videoIndex}: 没有保存的URL`);
    return;
  }

  console.log(`重新播放流 - 视频${videoIndex}, 线路: ${currentRouteTypes[videoIndex]}, URL: ${originalUrl}`);

  // 调用start函数重新播放，start函数会根据该窗口的线路类型选择协议
  start({
    index: videoIndex,
    url: originalUrl
  });
}

// 保存为预置点功能
function saveAsPreset() {
  hideContextMenu();
  if (currentVideoIndex >= 0) {
    console.log(`保存为预置点 - 视频${currentVideoIndex}`);

    // 通知WPF程序保存为预置位事件
    notifyWpfSaveAsPreset(currentVideoIndex);
  }
}

// 视频选中功能
function selectVideo(index) {
  // 移除之前选中的视频的高亮
  const previousSelected = document.querySelector('.video-container.selected');
  if (previousSelected) {
    previousSelected.classList.remove('selected');
  }

  // 添加新选中视频的高亮
  const videoContainer = document.querySelector(`.video-container:nth-child(${index + 1})`);
  if (videoContainer) {
    videoContainer.classList.add('selected');
    selectedVideoIndex = index;
    console.log(`选中视频窗口 ${index}`);

    // 同步选中视频的音量状态到音量控制
    syncVolumeControlWithSelectedVideo(index);

    // 更新线路选择的对号显示（根据当前选中窗口的线路类型）
    updateRouteCheckMarks();

    // 通知WPF程序选中的窗口索引
    notifyWpfVideoSelected(index);
  }
}

// 同步选中视频的音量状态到音量控制
function syncVolumeControlWithSelectedVideo(index) {
  const selectedVideo = document.getElementById(`video${index}`);
  if (selectedVideo) {
    // 同步静音状态
    isMuted = selectedVideo.muted;

    // 同步音量级别
    const videoVolume = selectedVideo.volume;
    if (isMuted) {
      // 如果视频是静音状态，显示音量为0，但保持实际音量值用于恢复
      currentVolumeLevel = Math.round(videoVolume * 15);
      if (currentVolumeLevel === 0) {
        currentVolumeLevel = 8; // 默认音量
      }
      previousVolumeLevel = currentVolumeLevel;
    } else {
      // 非静音状态，直接同步音量
      currentVolumeLevel = Math.round(videoVolume * 15);
      if (currentVolumeLevel === 0) {
        currentVolumeLevel = 8; // 默认音量
      }
    }

    // 更新音量条显示
    updateVolumeBars();

    // 更新音量图标
    updateVolumeIcon();

    console.log(`同步视频${index}的音量状态: 音量=${currentVolumeLevel}, 静音=${isMuted}, 保存音量=${previousVolumeLevel}`);
  }
}

// 通用的WPF通知函数
function notifyWpf(type, index = null, extraData = {}) {
  try {
    // 检查是否在WebView2环境中
    if (window.chrome && window.chrome.webview && window.chrome.webview.postMessage) {
      const message = {
        type: type,
        timestamp: new Date().toISOString(),
        ...extraData
      };

      // 只有当index不为null时才添加到消息中
      if (index !== null) {
        message.index = index;
      }

      window.chrome.webview.postMessage(message);

      // 根据类型生成相应的成功日志
      const logMessages = {
        'videoSelected': `已通知WPF程序：选中视频窗口 ${index}`,
        'playback': `已通知WPF程序：回放录像 - 视频${index}${extraData.fileName ? ', 文件: ' + extraData.fileName : ''}`,
        'marking': `已通知WPF程序：实时打标 - 视频${index}`,
        'saveAsPreset': `已通知WPF程序：保存为预置位 - 视频${index}`,
        'switchRoute': `已通知WPF程序：切换线路 - 视频${index}, 线路: ${extraData.routeType}, 协议: ${extraData.protocol}`
      };

      console.log(logMessages[type] || `已通知WPF程序：${type}`);
    } else {
      // 根据类型生成相应的非WebView2环境日志
      const logMessages = {
        'videoSelected': `非WebView2环境，无法通知WPF程序：选中视频窗口 ${index}`,
        'playback': `非WebView2环境，无法通知WPF程序：回放录像 - 视频${index}${extraData.fileName ? ', 文件: ' + extraData.fileName : ''}`,
        'marking': `非WebView2环境，无法通知WPF程序：实时打标 - 视频${index}`,
        'saveAsPreset': `非WebView2环境，无法通知WPF程序：保存为预置位 - 视频${index}`,
        'switchRoute': `非WebView2环境，无法通知WPF程序：切换线路 - 视频${index}, 线路: ${extraData.routeType}, 协议: ${extraData.protocol}`
      };

      console.log(logMessages[type] || `非WebView2环境，无法通知WPF程序：${type}`);
    }
  } catch (error) {
    console.error(`通知WPF程序${type}时发生错误:`, error);
  }
}

// 通知WPF程序视频选中事件
function notifyWpfVideoSelected(index) {
  notifyWpf('videoSelected', index);
}

// 通知WPF程序关闭事件
function notifyWpfClose(index) {
  notifyWpf('close', index);
}

// 通知WPF程序关闭全部事件
function notifyWpfCloseAll() {
  notifyWpf('closeAll');
}

// 通知WPF程序开始录像事件
function notifyWpfStartRecording(index) {
  notifyWpf('startRecording', index);
}

// 通知WPF程序回放录像事件
function notifyWpfPlayback(index) {
  notifyWpf('playback', index);
}

// 通知WPF程序实时打标事件
function notifyWpfMarking(index) {
  notifyWpf('marking', index);
}

// 通知WPF程序保存为预置位事件
function notifyWpfSaveAsPreset(index) {
  notifyWpf('saveAsPreset', index);
}

// 通知WPF程序切换码流事件
function notifyWpfSwitchStream(index, streamType) {
  notifyWpf('switchStream', index, { streamType: streamType });
}

// 通知WPF程序切换线路事件
function notifyWpfSwitchRoute(index, routeType, protocol) {
  notifyWpf('switchRoute', index, { routeType: routeType, protocol: protocol });
}

// 通知WPF程序全屏事件
function notifyWpfFullscreen(index) {
  notifyWpf('fullscreen', index);
}

// 通知WPF程序退出全屏事件
function notifyWpfExitFullscreen(index) {
  notifyWpf('exitFullscreen', index);
}

// 初始化鼠标悬停控制
function initMouseControls() {
  const videoContainers = document.querySelectorAll('.video-container');

  videoContainers.forEach((container, index) => {
    // 鼠标移动事件监听
    container.addEventListener('mousemove', function (e) {
      const rect = container.getBoundingClientRect();
      const mouseY = e.clientY - rect.top;

      // 计算触发区域高度 (视频高度的1/12 + 20px缓冲)
      const triggerHeight = container.offsetHeight / 12 + 20;

      // 如果鼠标在触发区域内，显示控制栏
      if (mouseY <= triggerHeight) {
        container.classList.add('show-controls');
      } else {
        // 鼠标离开顶部区域后，立即隐藏
        container.classList.remove('show-controls');
      }
    });

    // 鼠标离开容器时立即隐藏控制栏
    container.addEventListener('mouseleave', function () {
      container.classList.remove('show-controls');
    });

    // 鼠标在控制栏上时保持显示
    const controls = container.querySelector('.video-controls');
    if (controls) {
      controls.addEventListener('mouseenter', function () {
        container.classList.add('show-controls');
      });

      controls.addEventListener('mouseleave', function () {
        container.classList.remove('show-controls');
      });
    }
  });
}

// 右键菜单显示/隐藏函数
function showContextMenu(x, y, videoIndex) {
  const contextMenu = document.getElementById('contextMenu');
  currentVideoIndex = videoIndex;

  // 更新录像按钮状态
  updateRecordingMenuItem();

  // 更新码流选择对号显示
  updateStreamCheckMarks();

  // 更新线路选择对号显示
  updateRouteCheckMarks();

  // 更新音频按钮文本（现在是第9个菜单项，因为添加了录像相关菜单）
  const video = document.getElementById(`video${videoIndex}`);
  const menuItems = document.querySelectorAll('.context-menu-item');
  let audioMenuItem = null;

  menuItems.forEach(item => {
    if (item.getAttribute('onclick') === 'toggleCurrentAudio()') {
      audioMenuItem = item;
    }
  });

  if (video && audioMenuItem) {
    if (video.muted) {
      audioMenuItem.innerHTML = '打开音频';
    } else {
      audioMenuItem.innerHTML = '关闭音频';
    }
  }

  // 设置菜单位置
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  contextMenu.style.display = 'block';

  // 确保菜单不超出屏幕边界
  const rect = contextMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    contextMenu.style.left = (x - rect.width) + 'px';
  }
  if (rect.bottom > window.innerHeight) {
    contextMenu.style.top = (y - rect.height) + 'px';
  }
}

function hideContextMenu() {
  const contextMenu = document.getElementById('contextMenu');
  contextMenu.style.display = 'none';

  // 同时隐藏所有二级菜单
  const submenus = contextMenu.querySelectorAll('.submenu');
  submenus.forEach(submenu => {
    submenu.style.display = 'none';
  });
}

// 初始化右键菜单事件
function initContextMenu() {
  const videos = document.querySelectorAll('video');

  videos.forEach((video, index) => {
    // 禁用默认右键菜单
    video.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      showContextMenu(e.pageX, e.pageY, index);
    });

    // 添加点击选中功能
    video.addEventListener('click', function (e) {
      e.stopPropagation(); // 防止事件冒泡

      // 检查右键菜单是否显示
      const contextMenu = document.getElementById('contextMenu');
      const isMenuVisible = contextMenu.style.display === 'block';

      if (isMenuVisible) {
        // 如果菜单显示，先隐藏菜单，不执行选中
        hideContextMenu();
      } else {
        // 如果菜单未显示，执行选中
        selectVideo(index);
      }
    });
  });

  // 点击其他地方隐藏菜单和取消选中
  document.addEventListener('click', function (e) {
    // 检查右键菜单是否显示
    const contextMenu = document.getElementById('contextMenu');
    const isMenuVisible = contextMenu.style.display === 'block';

    // 如果菜单显示且点击的不是菜单内容，则隐藏菜单
    if (isMenuVisible && !e.target.closest('.context-menu')) {
      hideContextMenu();
      return; // 隐藏菜单后直接返回，不处理其他逻辑
    }
  });

  // 添加额外的mousedown事件监听，确保菜单能被隐藏
  document.addEventListener('mousedown', function (e) {
    const contextMenu = document.getElementById('contextMenu');
    const isMenuVisible = contextMenu.style.display === 'block';

    // 如果菜单显示且点击的不是菜单内容，则隐藏菜单
    if (isMenuVisible && !e.target.closest('.context-menu')) {
      hideContextMenu();
    }
  });

  // ESC键隐藏菜单
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      hideContextMenu();
    }
  });
}

// 音量控制功能
let currentVolumeLevel = 8; // 当前音量级别 (1-15)
let isMuted = false; // 是否静音
let previousVolumeLevel = 8; // 静音前的音量级别

function updateVolumeBars() {
  const volumeBars = document.querySelectorAll('.volume-bar');
  volumeBars.forEach((bar, index) => {
    const level = parseInt(bar.getAttribute('data-level'));

    // 如果是静音状态，显示音量为0（所有条形都不激活）
    const displayVolumeLevel = isMuted ? 0 : currentVolumeLevel;

    // 从底部开始激活：激活从15开始往下的条形
    // 例如：displayVolumeLevel=8时，激活level 15,14,13,12,11,10,9,8
    if (level >= (16 - displayVolumeLevel)) {
      bar.classList.add('active');
      bar.classList.remove('inactive');
    } else {
      bar.classList.add('inactive');
      bar.classList.remove('active');
    }
  });
}

function adjustVolume(level) {
  currentVolumeLevel = Math.max(0, Math.min(15, parseInt(level)));

  // 调整音量时取消静音状态
  isMuted = false;

  // 只更新选中视频的音量 (转换为0-1范围)
  const volumePercent = currentVolumeLevel / 15;
  if (selectedVideoIndex >= 0) {
    const selectedVideo = document.getElementById(`video${selectedVideoIndex}`);
    if (selectedVideo) {
      selectedVideo.volume = volumePercent;
      selectedVideo.muted = false;
      // 更新选中视频的静音按钮状态
      updateMuteButtonState(selectedVideoIndex, false);
    }
  }

  // 更新音量条显示
  updateVolumeBars();
  // 更新音量图标
  updateVolumeIcon();
}

function setMaxVolume() {
  currentVolumeLevel = 15;
  // 设置最大音量时取消静音状态
  isMuted = false;

  // 只更新选中视频的音量
  if (selectedVideoIndex >= 0) {
    const selectedVideo = document.getElementById(`video${selectedVideoIndex}`);
    if (selectedVideo) {
      selectedVideo.volume = 1.0;
      selectedVideo.muted = false;
      // 更新选中视频的静音按钮状态
      updateMuteButtonState(selectedVideoIndex, false);
    }
  }

  // 更新音量条显示
  updateVolumeBars();
  // 更新音量图标
  updateVolumeIcon();
}

function muteVolume() {
  if (isMuted) {
    // 取消静音，恢复之前的音量
    currentVolumeLevel = previousVolumeLevel;
    isMuted = false;
  } else {
    // 静音，保存当前音量
    previousVolumeLevel = currentVolumeLevel;
    currentVolumeLevel = 0;
    isMuted = true;
  }

  // 只更新选中视频的音量
  if (selectedVideoIndex >= 0) {
    const selectedVideo = document.getElementById(`video${selectedVideoIndex}`);
    if (selectedVideo) {
      const volumePercent = currentVolumeLevel / 15;
      selectedVideo.volume = volumePercent;
      selectedVideo.muted = isMuted;
      // 更新选中视频的静音按钮状态
      updateMuteButtonState(selectedVideoIndex, isMuted);
    }
  }

  // 更新音量条显示
  updateVolumeBars();
  // 更新音量图标
  updateVolumeIcon();
}

// 拖动相关变量
let isDragging = false;
let dragStartY = 0;
let dragStartVolume = 0;

function handleVolumeBarClick(event) {
  // 如果是拖动结束，不处理点击
  if (isDragging) return;

  const clickedBar = event.target.closest('.volume-bar');
  if (clickedBar) {
    const level = parseInt(clickedBar.getAttribute('data-level'));
    // 将点击的level转换为对应的音量级别
    // level 15 (底部) -> 音量级别 1
    // level 14 -> 音量级别 2
    // ...
    // level 1 (顶部) -> 音量级别 15
    const volumeLevel = 16 - level;
    adjustVolume(volumeLevel);
  }
}

function handleVolumeMouseDown(event) {
  isDragging = true;
  dragStartY = event.clientY;
  dragStartVolume = currentVolumeLevel;

  const container = event.currentTarget;
  container.classList.add('dragging');

  // 阻止默认行为和事件冒泡
  event.preventDefault();
  event.stopPropagation();

  // 添加全局鼠标事件监听
  document.addEventListener('mousemove', handleVolumeMouseMove);
  document.addEventListener('mouseup', handleVolumeMouseUp);
}

function handleVolumeMouseMove(event) {
  if (!isDragging) return;

  // 计算鼠标移动距离
  const deltaY = dragStartY - event.clientY; // 向上为正

  // 基于音量条容器高度计算灵敏度
  // 容器高度100px，15个级别，每个级别约6.67px
  const containerHeight = 100;
  const totalLevels = 15;
  const pixelsPerLevel = containerHeight / totalLevels; // 约6.67像素

  const volumeChange = Math.round(deltaY / pixelsPerLevel);

  // 计算新的音量级别
  const newVolumeLevel = Math.max(0, Math.min(15, dragStartVolume + volumeChange));

  // 更新音量
  if (newVolumeLevel !== currentVolumeLevel) {
    adjustVolume(newVolumeLevel);
  }
}

function handleVolumeMouseUp(event) {
  if (!isDragging) return;

  isDragging = false;

  const container = document.querySelector('.volume-slider-container');
  if (container) {
    container.classList.remove('dragging');
  }

  // 移除全局鼠标事件监听
  document.removeEventListener('mousemove', handleVolumeMouseMove);
  document.removeEventListener('mouseup', handleVolumeMouseUp);
}

// 为新加载的视频设置音量
function setVideoVolume(videoElement) {
  if (videoElement) {
    const volumePercent = currentVolumeLevel / 15;
    videoElement.volume = volumePercent;
  }
}

// 更新指定视频的静音按钮状态
function updateMuteButtonState(index, muted) {
  const muteBtn = document.querySelector(`.video-container:nth-child(${index + 1}) .control-btn[onclick="toggleMute(${index})"]`);
  if (muteBtn) {
    if (muted) {
      muteBtn.innerHTML = getSVGIcon('volume-off');
      muteBtn.classList.add('muted');
      muteBtn.title = '取消静音';
    } else {
      muteBtn.innerHTML = getSVGIcon('volume-on');
      muteBtn.classList.remove('muted');
      muteBtn.title = '静音';
    }
  }
}

// 更新layout-controls中的音量图标
function updateVolumeIcon() {
  const volumeIcons = document.querySelectorAll('.volume-icon img');
  if (volumeIcons.length >= 2) {
    const maxVolumeIcon = volumeIcons[0]; // 第一个是最大音量图标
    const muteIcon = volumeIcons[1]; // 第二个是静音图标

    if (isMuted || currentVolumeLevel === 0) {
      // 静音状态：最大音量图标变暗，静音图标高亮
      maxVolumeIcon.style.opacity = '0.5';
      muteIcon.style.opacity = '1';
    } else {
      // 非静音状态：最大音量图标正常，静音图标变暗
      maxVolumeIcon.style.opacity = '1';
      muteIcon.style.opacity = '0.5';
    }
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {
  initMouseControls();
  initContextMenu();

  // 初始化音量控制条显示
  updateVolumeBars();

  // 初始化音量图标状态
  updateVolumeIcon();

  // 默认选中第一个视频窗口
  if (selectedVideoIndex < 0) {
    selectVideo(0);
  }

  // 防止拖动时选中文本
  document.addEventListener('selectstart', function (e) {
    if (isDragging) {
      e.preventDefault();
    }
  });
});

/**
 * 通过 TS 协议播放视频
 * @param {string} url - TS 流地址
 * @param {Object} options - 播放选项
 * @param {HTMLElement} options.videoElement - 视频元素
 * @param {boolean} options.isLive - 是否为直播流，默认为 true
 * @param {boolean} options.enableStashBuffer - 是否启用缓存，默认为 false
 * @param {Function} options.onSuccess - 播放成功回调
 * @param {Function} options.onError - 播放错误回调
 * @param {Function} options.onDestroy - 销毁回调
 * @returns {Object} 返回播放器实例和控制方法
 */
function start_play_ts(url, options = {}) {
    // 默认配置
    const defaultOptions = {
        videoElement: null,
        isLive: true,
        enableStashBuffer: false,
        onSuccess: null,
        onError: null,
        onDestroy: null
    };
    
    const config = { ...defaultOptions, ...options };
    
    // 检查 mpegts 库是否可用
    if (typeof mpegts === 'undefined') {
        const error = new Error('mpegts 库未加载');
        if (config.onError) {
            config.onError(error);
        }
        throw error;
    }
    
    // 检查浏览器是否支持 MSE
    if (!mpegts.getFeatureList().mseLivePlayback) {
        const error = new Error('浏览器不支持 MSE 直播播放');
        if (config.onError) {
            config.onError(error);
        }
        throw error;
    }
    
    // 检查视频元素
    if (!config.videoElement) {
        const error = new Error('视频元素不能为空');
        if (config.onError) {
            config.onError(error);
        }
        throw error;
    }
    
    let tsPlayer = null;
    
    try {
        // 创建 TS 播放器
        tsPlayer = mpegts.createPlayer({
            type: 'mpegts',
            url: url,
            isLive: config.isLive,
            enableStashBuffer: config.enableStashBuffer
        });
        
        // 绑定视频元素
        tsPlayer.attachMediaElement(config.videoElement);
        
        // 事件监听
        tsPlayer.on(mpegts.Events.MEDIA_INFO, (mediaInfo) => {
            console.log('TS 播放器媒体信息:', mediaInfo);
        });
        
        tsPlayer.on(mpegts.Events.STATISTICS_INFO, (stats) => {
            console.log('TS 播放器统计信息:', stats);
        });
        
        tsPlayer.on(mpegts.Events.ERROR, (errorType, errorDetail) => {
            console.error('TS 播放器错误:', errorType, errorDetail);
            if (config.onError) {
                config.onError(new Error(`播放错误: ${errorType} - ${errorDetail}`));
            }
        });
        
        tsPlayer.on(mpegts.Events.LOADING_COMPLETE, () => {
            console.log('TS 流加载完成');
        });
        
        tsPlayer.on(mpegts.Events.RECOVERED_EARLY_EOF, () => {
            console.log('TS 流恢复播放');
        });
        
        // 加载并播放
        tsPlayer.load();
        tsPlayer.play().then(() => {
            console.log('TS 播放器开始播放');
            if (config.onSuccess) {
                config.onSuccess(tsPlayer);
            }
        }).catch((error) => {
            console.error('TS 播放器播放失败:', error);
            if (config.onError) {
                config.onError(error);
            }
        });
        
    } catch (error) {
        console.error('创建 TS 播放器失败:', error);
        if (config.onError) {
            config.onError(error);
        }
        throw error;
    }
    
    // 返回播放器控制接口
    return {
        player: tsPlayer,
        
        // 播放
        play: () => {
            if (tsPlayer) {
                return tsPlayer.play();
            }
        },
        
        // 暂停
        pause: () => {
            if (tsPlayer) {
                tsPlayer.pause();
            }
        },
        
        // 停止
        stop: () => {
            if (tsPlayer) {
                tsPlayer.unload();
            }
        },
        
        // 销毁
        destroy: () => {
            if (tsPlayer) {
                tsPlayer.destroy();
                tsPlayer = null;
                if (config.onDestroy) {
                    config.onDestroy();
                }
            }
        },
        
        // 获取播放状态
        getState: () => {
            if (tsPlayer) {
                return {
                    readyState: tsPlayer.readyState,
                    networkState: tsPlayer.networkState,
                    paused: tsPlayer.paused,
                    ended: tsPlayer.ended,
                    currentTime: tsPlayer.currentTime,
                    duration: tsPlayer.duration
                };
            }
            return null;
        },
        
        // 设置音量
        setVolume: (volume) => {
            if (tsPlayer && config.videoElement) {
                config.videoElement.volume = Math.max(0, Math.min(1, volume));
            }
        },
        
        // 获取音量
        getVolume: () => {
            if (config.videoElement) {
                return config.videoElement.volume;
            }
            return 0;
        },
        
        // 设置播放速率
        setPlaybackRate: (rate) => {
            if (tsPlayer) {
                tsPlayer.playbackRate = rate;
            }
        },
        
        // 获取播放速率
        getPlaybackRate: () => {
            if (tsPlayer) {
                return tsPlayer.playbackRate;
            }
            return 1;
        }
    };
}

// 使用示例：
/*
// 基本使用
const videoElement = document.getElementById('video_player');
const tsController = start_play_ts('http://example.com/stream.ts', {
    videoElement: videoElement,
    onSuccess: (player) => {
        console.log('TS 播放成功');
    },
    onError: (error) => {
        console.error('TS 播放失败:', error);
    }
});

// 控制播放
tsController.play();
tsController.pause();
tsController.setVolume(0.5);
tsController.destroy();
*/

/**
 * 切换视频统计信息显示
 */
function toggleVideoStats() {
  hideContextMenu();

  if (currentVideoIndex >= 0) {
    const statsElement = document.getElementById(`stats${currentVideoIndex}`);
    if (statsElement) {
      if (videoStatsVisible[currentVideoIndex]) {
        statsElement.style.display = 'none';
        videoStatsVisible[currentVideoIndex] = false;
        console.log(`隐藏视频${currentVideoIndex}统计信息`);
      } else {
        statsElement.style.display = 'block';
        videoStatsVisible[currentVideoIndex] = true;
        console.log(`显示视频${currentVideoIndex}统计信息`);
      }
    }
  }
}

/**
 * 隐藏指定视频窗口的统计信息
 * @param {number} windowIndex - 视频窗口索引
 */
function hideVideoStats(windowIndex) {
  const statsElement = document.getElementById(`stats${windowIndex}`);
  if (statsElement) {
    statsElement.style.display = 'none';
    videoStatsVisible[windowIndex] = false;
    console.log(`关闭视频${windowIndex}统计信息`);
  }
}

/**
 * 更新视频窗口内的统计信息显示
 * @param {number} windowIndex - 视频窗口索引
 * @param {string} type - 统计信息类型 ('decode' 或 'bitrate')
 * @param {Object} data - 统计信息数据
 */
function updateVideoStats(windowIndex, type, data) {
  // 只有在统计信息可见时才更新
  if (!videoStatsVisible[windowIndex]) {
    return;
  }

  if (type === 'decode') {
    // 更新编解码器信息
    const codecElement = document.getElementById(`codec${windowIndex}`);
    if (codecElement) {
      codecElement.textContent = `编解码器: ${data.codecName || 'Unknown'}`;
    }

    // 更新分辨率信息
    const resolutionElement = document.getElementById(`resolution${windowIndex}`);
    if (resolutionElement) {
      resolutionElement.textContent = `分辨率: ${data.frameWidth}×${data.frameHeight}`;
    }

    // 更新帧率信息
    const fpsElement = document.getElementById(`fps${windowIndex}`);
    if (fpsElement) {
      fpsElement.textContent = `帧率: ${data.framesPerSecond} fps`;
    }

    // 更新解码帧率信息（每秒解码帧数）
    const framesElement = document.getElementById(`frames${windowIndex}`);
    if (framesElement) {
      // 计算每秒解码帧数，如果没有历史数据则显示当前帧率
      const decodedFramesPerSecond = data.framesPerSecond || 0;
      framesElement.textContent = `解码帧率: ${decodedFramesPerSecond} fps`;
    }

    // 更新丢帧信息
    const dropsElement = document.getElementById(`drops${windowIndex}`);
    if (dropsElement) {
      dropsElement.textContent = `丢帧: ${data.framesDropped}`;
    }

    // 更新关键帧信息
    const keyframesElement = document.getElementById(`keyframes${windowIndex}`);
    if (keyframesElement) {
      keyframesElement.textContent = `关键帧: ${data.keyFramesDecoded}`;
    }

    // 更新解码时间信息
    const decodetimeElement = document.getElementById(`decodetime${windowIndex}`);
    if (decodetimeElement) {
      const avgDecodeTime = data.framesDecoded > 0 ? (data.totalDecodeTime * 1000 / data.framesDecoded).toFixed(1) : 0;
      decodetimeElement.textContent = `解码时间: ${avgDecodeTime}ms`;
    }

  } else if (type === 'bitrate') {
    // 更新码率信息
    const bitrateElement = document.getElementById(`bitrate${windowIndex}`);
    if (bitrateElement) {
      const bitrateKbps = (data.videoBitrate / 1000).toFixed(0);
      bitrateElement.textContent = `码率: ${bitrateKbps} kbps`;
    }



    // 更新丢包信息
    const packetlossElement = document.getElementById(`packetloss${windowIndex}`);
    if (packetlossElement) {
      packetlossElement.textContent = `丢包: ${data.packetsLost}(${data.packetLossRate}%)`;
    }

    // 更新网络抖动信息
    const jitterElement = document.getElementById(`jitter${windowIndex}`);
    if (jitterElement) {
      const jitterMs = (data.jitter * 1000).toFixed(1);
      jitterElement.textContent = `抖动: ${jitterMs}ms`;
    }

    // 更新往返时延信息
    const rttElement = document.getElementById(`rtt${windowIndex}`);
    if (rttElement) {
      const rttMs = (data.roundTripTime * 1000).toFixed(0);
      rttElement.textContent = `时延: ${rttMs}ms`;
    }
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  initMouseControls();

  // 添加全局鼠标事件监听器
  document.addEventListener('mousemove', handleVolumeMouseMove);
  document.addEventListener('mouseup', handleVolumeMouseUp);
});
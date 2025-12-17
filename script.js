// ==================== 1. 配置中心 (通用兜底版) ====================

// 1. 硅基流动 (国产专线：速度快、稳定)
const SILICON_CONFIG = {
    url: "https://api.siliconflow.cn/v1/chat/completions",
    key: "sk-plqtzdkeeirfvmoyltlzsxyhwhhjngtpmczkiddjxgrbtmxw" 
};

// 2. OpenRouter (万能聚合：什么都有)
const OPENROUTER_CONFIG = {
    url: "https://openrouter.ai/api/v1/chat/completions",
    // 👇 你的完整 Key
    key: "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" 
};

// 3. 💎 VIP 路由表 (只登记需要“特权通道”的模型)
// 这里只放必须走“硅基流动”的模型，其他的全部自动甩给 OpenRouter
const MODEL_ROUTER = {
    // 强制 DeepSeek 走硅基 (因为硅基是 DeepSeek 的官方合作伙伴，可能更快)
    "deepseek-ai/DeepSeek-V2.5": SILICON_CONFIG,
    "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B": SILICON_CONFIG,
    
    // 强制 Qwen 走硅基
    "Qwen/Qwen2.5-72B-Instruct": SILICON_CONFIG,
    
    // ❌ 其他的 Llama, Gemini, Xiaomi... 都不用在这里写了！
    // 只要这里没写的，统统自动发给 OpenRouter。
};

const SUPABASE_URL = "https://uvwxgbppxxpxqrldrlgs.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_5IAi4u1-IKiv_8kU36eizg_XGEpxc5C"; 
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentModel = "Qwen/Qwen2.5-72B-Instruct"; 
let currentSystemPrompt = "你是一个乐于助人的 AI 助手。";
let currentSessionId = null; 

// ==================== 2. 小红书图片工厂 (保持不变) ====================
const topicInput = document.getElementById('topicInput');
const generateBtn = document.getElementById('generateBtn');
const resultArea = document.getElementById('xhs-container');

function showFactoryLoading() {
    const loader = document.createElement('div');
    loader.id = 'active-loader';
    loader.className = 'loading-box';
    loader.style.display = 'block';
    loader.innerHTML = `<div class="loading-spinner"></div><div class="loading-text">🏭 生产线正在疯狂运转...</div>`;
    if(resultArea) resultArea.insertBefore(loader, resultArea.firstChild);
}
function hideFactoryLoading() {
    const loader = document.getElementById('active-loader');
    if (loader) loader.remove();
}
function renderCard(title, content, imageUrl, dateStr) {
    if (!resultArea) return;
    const card = document.createElement('div');
    card.className = 'note-card';
    const timeDisplay = dateStr ? new Date(dateStr).toLocaleString() : '刚刚';
    card.innerHTML = `
        <div class="note-date">${timeDisplay}</div>
        <div class="note-card-body">
            <img src="${imageUrl}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px;">
            <div class="note-info">
                <div class="note-title">${title}</div>
                <div class="note-preview">${content}</div>
            </div>
        </div>
    `;
    card.onclick = () => {
        const modal = document.getElementById('note-modal');
        document.getElementById('modal-note-title').innerText = title;
        document.getElementById('modal-note-content').innerText = content;
        document.getElementById('modal-note-image').src = imageUrl;
        modal.classList.add('active');
    };
    resultArea.insertBefore(card, resultArea.firstChild);
}
if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
        const topic = topicInput.value;
        if (!topic) return alert("老板，请输入主题再生产！");
        generateBtn.disabled = true;
        generateBtn.innerText = "⏳ 生产中...";
        showFactoryLoading(); 
        const { error } = await client.from('tasks').insert([{ topic: topic, status: 'pending' }]);
        if (error) {
            alert("下单失败: " + error.message);
            hideFactoryLoading();
            generateBtn.disabled = false;
            generateBtn.innerText = "🚀 立即生产";
        }
    });
}
client.channel('public:xhs_notes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'xhs_notes' }, payload => {
        hideFactoryLoading(); 
        renderCard(payload.new.title, payload.new.content, payload.new.image_url, payload.new.created_at);
        if (generateBtn) { generateBtn.disabled = false; generateBtn.innerText = "🚀 立即生产"; }
    }).subscribe();
async function loadHistory() {
    const { data, error } = await client.from('xhs_notes').select('*').order('created_at', { ascending: true });
    if (!error && resultArea) {
        resultArea.innerHTML = ''; 
        data.forEach(note => renderCard(note.title, note.content, note.image_url, note.created_at));
    }
}
function closeNoteModal() {
    const modal = document.getElementById('note-modal');
    if (modal) modal.classList.remove('active');
}
loadHistory();

// ==================== 3. AI 自由对话 (通用路由版) ====================

// 🟢 1. 打开窗口
function startChat(agentName, prompt, modelName) {
    const modal = document.getElementById('app-modal');
    const titleEl = document.getElementById('modal-title');
    if (titleEl) titleEl.innerText = agentName;
    if (modal) modal.classList.add('active'); 
    
    currentSystemPrompt = prompt || "你是一个乐于助人的 AI 助手。";
    
    // 默认使用 Gemini (因为它是通用的，如果没传名字就用这个)
    currentModel = modelName || "google/gemini-2.0-flash-exp:free"; 
    
    console.log(`🧠 准备切换大脑: ${currentModel}`);
    loadSessionList(); 
    startNewSession(); 
}

// 🟢 2. 开启新会话
function startNewSession() {
    currentSessionId = null; 
    const historyEl = document.getElementById('chat-history');
    const agentName = document.getElementById('modal-title').innerText;
    
    // 欢迎语里显示当前模型，方便调试
    historyEl.innerHTML = `<div class="message ai">👋 你好！我是 <b>${agentName}</b>。<br><span style="font-size:10px; opacity:0.6">当前模型: ${currentModel}</span></div>`;
    
    document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
}

// 🟢 3. 加载左侧列表 (升级版：带删除按钮)
async function loadSessionList() {
    const listEl = document.getElementById('session-list');
    listEl.innerHTML = '<div style="color:#666; font-size:12px; padding:10px;">加载中...</div>';
    
    const { data, error } = await client.from('chat_sessions').select('*').order('created_at', { ascending: false });
    if (error) return console.error(error);
    
    listEl.innerHTML = ''; 
    
    data.forEach(session => {
        // 1. 创建外层容器
        const item = document.createElement('div');
        item.className = 'history-item';
        
        // 2. 创建标题 span
        const titleSpan = document.createElement('span');
        titleSpan.className = 'history-title';
        titleSpan.innerText = session.title || "新对话";
        
        // 3. 创建删除按钮 span
        const delBtn = document.createElement('span');
        delBtn.className = 'history-delete-btn';
        delBtn.innerHTML = '&times;'; // 这是一个 × 符号
        delBtn.title = "删除这条记录";
        
        // 4. 给删除按钮绑定事件
        delBtn.onclick = (e) => {
            e.stopPropagation(); // ✋ 关键！阻止点击冒泡，防止点删除时误触发“加载对话”
            deleteSession(session.id);
        };

        // 5. 点击整行加载对话
        item.onclick = () => loadSession(session.id, item);
        
        // 6. 组装
        item.appendChild(titleSpan);
        item.appendChild(delBtn);
        listEl.appendChild(item);
    });
}

// 🔴 新增：删除会话函数
async function deleteSession(sessionId) {
    // 1. 二次确认，防止手滑
    if (!confirm("确定要永久删除这条对话记录吗？")) return;

    // 2. 数据库删除操作
    // 因为 Supabase 建表时设置了 cascade，删了会话，里面的消息也会自动删掉
    const { error } = await client.from('chat_sessions').delete().eq('id', sessionId);

    if (error) {
        alert("删除失败: " + error.message);
    } else {
        // 3. 如果删的是当前正在聊的，就清空屏幕
        if (currentSessionId === sessionId) {
            startNewSession();
        }
        // 4. 刷新左侧列表
        loadSessionList();
    }
}
// 🟢 4. 点击加载历史
async function loadSession(sessionId, domElement) {
    currentSessionId = sessionId;
    const historyEl = document.getElementById('chat-history');
    historyEl.innerHTML = '<div class="typing-indicator" style="padding:20px;">正在读取记忆...</div>';
    document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
    if(domElement) domElement.classList.add('active');
    
    const { data, error } = await client.from('chat_messages').select('*').eq('session_id', sessionId).order('created_at', { ascending: true });
    const { data: sessionData } = await client.from('chat_sessions').select('system_prompt').eq('id', sessionId).single();
    
    if(sessionData) currentSystemPrompt = sessionData.system_prompt;
    if (error) return alert("读取失败");
    
    historyEl.innerHTML = '';
    data.forEach(msg => {
        const roleClass = msg.role === 'user' ? 'user' : 'ai';
        const content = (typeof marked !== 'undefined') ? marked.parse(msg.content) : msg.content;
        historyEl.innerHTML += `<div class="message ${roleClass}">${content}</div>`;
    });
    historyEl.scrollTop = historyEl.scrollHeight;
}

// 🔥 核心：发送消息
async function sendMessage() {
    const inputEl = document.getElementById('user-input');
    const historyEl = document.getElementById('chat-history');
    const sendBtn = document.getElementById('send-btn');
    const userText = inputEl.value.trim();
    if (!userText) return;

    // A. 注册会话
    if (!currentSessionId) {
        const { data, error } = await client.from('chat_sessions').insert([{ 
            title: userText.substring(0, 15), 
            system_prompt: currentSystemPrompt 
        }]).select().single();
        if (error) return alert("创建会话失败");
        currentSessionId = data.id;
        loadSessionList(); 
    }

    // B. UI上屏
    historyEl.innerHTML += `<div class="message user">${userText}</div>`;
    inputEl.value = ''; 
    historyEl.scrollTop = historyEl.scrollHeight;
    sendBtn.disabled = true;
    sendBtn.innerText = "思考中...";

    // C. 读取记忆
    let contextMessages = [];
    if (currentSessionId) {
        const { data: historyData } = await client.from('chat_messages')
            .select('role, content')
            .eq('session_id', currentSessionId)
            .order('created_at', { ascending: false }).limit(6);
        if (historyData) contextMessages = historyData.reverse();
    }
    await client.from('chat_messages').insert([{ session_id: currentSessionId, role: 'user', content: userText }]);

    // D. 构造消息包
    const finalMessages = [
        { role: "system", content: currentSystemPrompt },
        ...contextMessages,
        { role: "user", content: userText }
    ];

    const loadingId = 'loading-' + Date.now();
    historyEl.innerHTML += `<div class="message ai" id="${loadingId}"><span class="typing-indicator">信念引擎正在思考...</span></div>`;
    historyEl.scrollTop = historyEl.scrollHeight;

    try {
        // 🔥🔥🔥 核心魔法修改：智能路由 🔥🔥🔥
        // 1. 先去查 VIP 表 (MODEL_ROUTER)
        // 2. 如果 VIP 表里没有，就默认发给 OPENROUTER_CONFIG
        // 这样以后任何新模型，你只要把名字传过来，都会自动发给 OpenRouter，不用改代码！
        const config = MODEL_ROUTER[currentModel] || OPENROUTER_CONFIG; 
        
        console.log(`🚀 调用: ${currentModel} -> ${config.url}`);

        const response = await fetch(config.url, {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${config.key}`, 
                "Content-Type": "application/json",
                "HTTP-Referer": window.location.href 
            },
            body: JSON.stringify({
                model: currentModel,
                messages: finalMessages,
                stream: false 
            })
        });

        const resJson = await response.json();
        
        // 错误处理优化
        if (resJson.error) {
            console.error("API返回错误:", resJson);
            throw new Error(resJson.error.message || "未知API错误，请F12查看控制台");
        }

        const aiText = resJson.choices[0].message.content;

        // E. 存入数据库
        await client.from('chat_messages').insert([{
            session_id: currentSessionId, role: 'assistant', content: aiText
        }]);

        // F. 渲染结果
        document.getElementById(loadingId).remove();
        const displayText = (typeof marked !== 'undefined') ? marked.parse(aiText) : aiText;
        historyEl.innerHTML += `<div class="message ai">${displayText}</div>`;

    } catch (err) {
        console.error(err);
        document.getElementById(loadingId).innerText = `❌ 出错了: ${err.message}`;
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerText = "发送";
        historyEl.scrollTop = historyEl.scrollHeight;
    }
}

function closeApp() { document.getElementById('app-modal').classList.remove('active'); }
function handleEnter(event) { if (event.key === 'Enter') sendMessage(); }
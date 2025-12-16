// =======================================================
// 全局配置区
// =======================================================
let apiKey = localStorage.getItem('silicon_api_key') || "";
const SUPABASE_URL = "https://uvwxgbppxxpxqrldrlgs.supabase.co";
const SUPABASE_KEY = "sb_publishable_5IAi4u1-IKiv_8kU36eizg_XGEpxc5C";

// 初始化 Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 页面加载完毕后执行
document.addEventListener('DOMContentLoaded', () => {
    checkApiKey();
    fetchNotes(); 
});

// =======================================================
// 功能一：右侧笔记流 (强制样式版)
// =======================================================

async function fetchNotes() {
    console.log("正在刷新笔记列表...");
    const { data, error } = await supabase
        .from('xhs_notes')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("加载失败:", error);
    } else {
        renderNotes(data);
    }
}

function renderNotes(notes) {
    const container = document.getElementById('xhs-container');
    if (!container) return;
    container.innerHTML = ""; // 清空旧数据

    // 这是一个永远不会挂的灰色方块图 (Base64编码)，不用联网也能显示
    const fallbackImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' fill='%23666' dy='.3em' text-anchor='middle' font-family='Arial' font-size='12'%3E无图%3C/text%3E%3C/svg%3E";

    notes.forEach(note => {
        const dateStr = new Date(note.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        
        const card = document.createElement('div');
        // 给卡片加上强制的基础样式
        card.style.cssText = `
            background: rgba(30, 30, 40, 0.8);
            border: 1px solid rgba(0, 243, 255, 0.3);
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 15px;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        // 鼠标悬停效果通过 JS 实现 (选做)
        card.onmouseover = () => card.style.borderColor = '#00f3ff';
        card.onmouseout = () => card.style.borderColor = 'rgba(0, 243, 255, 0.3)';

        // 强制HTML结构 + 内联样式
        card.innerHTML = `
            <div style="font-size: 12px; color: #00f3ff; font-family: monospace; opacity: 0.8;">
                🕒 ${dateStr}
            </div>
            
            <div style="display: flex; align-items: center; gap: 12px;">
                <img src="${note.image_url}" 
                     onerror="this.src='${fallbackImage}'"
                     style="width: 80px; height: 80px; min-width: 80px; object-fit: cover; border-radius: 6px; background: #000; display: block;">
                
                <div style="flex: 1; overflow: hidden;">
                    <div style="font-size: 14px; font-weight: bold; color: #fff; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${note.title || '无标题'}
                    </div>
                    <div style="font-size: 12px; color: #aaa; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                        ${(note.content || '暂无内容').replace(/</g, '&lt;')}
                    </div>
                </div>
            </div>
        `;

        // 点击打开详情
        card.onclick = () => openNoteModal(note);
        container.appendChild(card);
    });
}

// 详情弹窗逻辑
function openNoteModal(note) {
    const modal = document.getElementById('note-modal');
    // 填充数据 (使用更安全的方式)
    document.getElementById('modal-note-image').src = note.image_url || '';
    document.getElementById('modal-note-title').textContent = note.title;
    
    // 处理换行
    const content = note.content || '暂无内容';
    document.getElementById('modal-note-content').innerHTML = content.replace(/\n/g, '<br>');

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeNoteModal() {
    document.getElementById('note-modal').classList.remove('active');
    document.body.style.overflow = '';
}

// =======================================================
// 功能二：AI 聊天 & 任务 (保持不变)
// =======================================================
async function sendTask() {
    const input = document.getElementById('topicInput');
    const topic = input.value.trim();
    if (!topic) { alert("请输入主题！"); return; }
    const { error } = await supabase.from('tasks').insert([{ topic: topic }]);
    if (!error) { alert("✅ 指令已发送！"); input.value = ""; } 
    else { alert("❌ 发送失败"); }
}

const appModal = document.getElementById('app-modal');
const chatHistory = document.getElementById('chat-history');
const userInput = document.getElementById('user-input');
let currentSystemPrompt = "";

function startChat(title, prompt) {
    if (!apiKey) { setApiKey(); return; }
    document.getElementById('modal-title').textContent = title;
    currentSystemPrompt = prompt;
    chatHistory.innerHTML = `<div class="message ai">已启动【${title}】</div>`;
    appModal.classList.add('active');
}
function closeApp() { appModal.classList.remove('active'); }
// =======================================================
// 补全：AI 聊天发送逻辑
// =======================================================
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    
    // 1. 先把自己的话显示在屏幕上
    appendMessage('user', text);
    userInput.value = '';

    // 2. 发送给 SiliconFlow
    try {
        const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${apiKey}` 
            },
            body: JSON.stringify({
                model: "deepseek-ai/DeepSeek-V3", // 确保用的是 V3
                messages: [
                    { role: "system", content: currentSystemPrompt }, 
                    { role: "user", content: text }
                ],
                temperature: 0.7
            })
        });
        
        const data = await response.json();
        
        if (data.choices && data.choices.length > 0) {
            appendMessage('ai', data.choices[0].message.content);
        } else {
            console.error(data);
            appendMessage('ai', "❌ 服务繁忙或 Key 无效，请检查控制台。");
        }
    } catch (e) {
        appendMessage('ai', "❌ 网络错误：" + e.message);
    }
}

// 辅助：把消息加到聊天框
function appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    
    // 如果引入了 marked.js 就用 markdown 渲染，否则直接显示文本
    if (typeof marked !== 'undefined') {
        div.innerHTML = marked.parse(text);
    } else {
        div.innerText = text; // 防止乱码
    }
    
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight; // 自动滚到底部
}

// 辅助：回车发送
function handleEnter(e) {
    if (e.key === 'Enter') sendMessage();
}

// 辅助函数
function setApiKey() { let key = prompt("API Key:", apiKey); if(key) { apiKey = key.trim(); localStorage.setItem('silicon_api_key', apiKey); } }
function checkApiKey() { if(!apiKey) console.log("No Key"); }

// 点击背景关闭
window.onclick = function(e) {
    if (e.target === document.getElementById('note-modal')) closeNoteModal();
    if (e.target === appModal) closeApp();
}
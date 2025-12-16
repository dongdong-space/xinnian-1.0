import requests
import json
import time
from supabase import create_client, Client

# === 1. 核心配置 ===
# 🔴 🔴 🔴 必填：你的硅基流动 API Key
SILICON_KEY = "sk-plqtzdkeeirfvmoyltlzsxyhwhhjngtpmczkiddjxgrbtmxw"

# 🟢 Supabase 配置
SUPABASE_URL = "https://uvwxgbppxxpxqrldrlgs.supabase.co"
SUPABASE_KEY = "sb_publishable_5IAi4u1-IKiv_8kU36eizg_XGEpxc5C"

# API 地址
TEXT_URL = "https://api.siliconflow.cn/v1/chat/completions"
IMAGE_URL = "https://api.siliconflow.cn/v1/images/generations"

# 连接数据库
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ 工厂启动成功！正在等待老板派单...")
except Exception as e:
    print(f"❌ 数据库连接失败: {e}")

# === 2. 工具函数 (文案+图片+上传) ===
def generate_text(topic):
    print(f"🧠 正在思考文案：{topic}...")
    system_prompt = """
    你是一个小红书爆款专家。请生成JSON格式内容：
    {
        "title": "标题",
        "content": "正文",
        "image_prompt": "英文AI绘画提示词, 8k uhd, photorealistic, high quality"
    }
    """
    try:
        payload = {
            "model": "deepseek-ai/DeepSeek-V3",
            "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": f"主题：{topic}"}],
            "response_format": {"type": "json_object"}
        }
        headers = {"Authorization": f"Bearer {SILICON_KEY}", "Content-Type": "application/json"}
        resp = requests.post(TEXT_URL, json=payload, headers=headers)
        return resp.json()['choices'][0]['message']['content']
    except Exception as e:
        print(f"💥 文案生成出错: {e}")
        return None

def generate_image_url(prompt):
    print(f"🎨 正在绘制图片...")
    try:
        payload = {
            "model": "black-forest-labs/FLUX.1-schnell",
            "prompt": prompt,
            "image_size": "1024x1024"
        }
        headers = {"Authorization": f"Bearer {SILICON_KEY}", "Content-Type": "application/json"}
        resp = requests.post(IMAGE_URL, json=payload, headers=headers)
        return resp.json()['data'][0]['url']
    except Exception as e:
        print(f"💥 画图出错: {e}")
        return None

def upload_result(title, content, image_url):
    print(f"☁️ 正在入库...")
    data = {"title": title, "content": content, "image_url": image_url}
    supabase.table("xhs_notes").insert(data).execute()

# === 3. 核心循环：不知疲倦的工人 ===
def start_worker():
    while True:
        try:
            # 1. 去 'tasks' 表找 'pending' (待处理) 的任务
            response = supabase.table("tasks").select("*").eq("status", "pending").execute()
            tasks = response.data

            if tasks:
                task = tasks[0] # 每次只做一个，做完再拿下一个
                print("="*30)
                print(f"🔔 接到新任务：{task['topic']}")
                
                # 2. 开始生产
                json_str = generate_text(task['topic'])
                if json_str:
                    data = json.loads(json_str)
                    img_url = generate_image_url(data['image_prompt'])
                    
                    if img_url:
                        # 3. 存入结果表
                        upload_result(data['title'], data['content'], img_url)
                        
                        # 4. 标记任务为 'completed' (已完成)
                        supabase.table("tasks").update({"status": "completed"}).eq("id", task['id']).execute()
                        print(f"✅ 任务搞定！等待下一个...")
            else:
                # 没有任务时，休息 3 秒再看
                print("💤 暂无任务，待机中...", end="\r")
            
            time.sleep(3)
            
        except Exception as e:
            print(f"⚠️ 发生小错误 (不影响运行): {e}")
            time.sleep(3)

# === 入口 ===
if __name__ == "__main__":
    if "sk-xxxx" in SILICON_KEY:
        print("❌ 请先填入 API Key！")
    else:
        start_worker()
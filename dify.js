/**
 * Dify API 集成模块 - 提供与Dify工作流和文件处理相关的功能
 * @module dify
 */

/**
 * 文件列表ID
 * @type {string|undefined}
 */
let fileListId;

/**
 * 文件列表输出结果
 * @type {Object|undefined}
 */
let listFileOutputs;

/**
 * PDF输出结果
 * @type {string|undefined}
 */
let PDFOutputs;

//上传文件到工作流，返回id，列表，时间
/*
async function difyList(file) {
    try {
        const API_KEY = ''; // 在 Dify「访问 API」里创建
        const USER = 'admin'; // 与你的工作流 user 一致
        const DIFY_HOST = ''; // 自建请换成对应域名

        const fileId = file.files[0];
//将文件保存到fileId
        const fd = new FormData();
        fd.append('file', fileId); // 假设 fileId 是文件对象
        fd.append('user', USER);
        // 调用后端API
        const listRes = await fetch(`${DIFY_HOST}/v1/files/upload`, {
            method: 'POST',
            headers: {Authorization: `Bearer ${API_KEY}`},
            body: fd
        });

        if (!listRes.ok) {
            throw new Error(`Request failed with status ${listRes.status}`);
        }

        const {id: dataId} = await listRes.json();
        fileListId = dataId;
        console.log('✅ 上传成功，file_id =', dataId);

        // 把 uploadedFileId 交给工作流继续处理
        const worklistRes = await runListflow(fileListId);
        console.log(worklistRes);
        const {data} = worklistRes;
        const {outputs: fileOutputs} = data;
        listFileOutputs = fileOutputs;
        console.log(listFileOutputs);
    } catch (error) {
        alert("工作流处理失败：" + error.message);
    }
}
*/
//列表工作流处理
/**
 * 运行列表处理工作流
 * 用于处理上传的CSV文件并返回文件元数据
 * @async
 * @param {string} uploadedFileId - 已上传文件的ID
 * @returns {Promise<Object>} 工作流执行结果
 * @throws {Error} 当工作流执行失败时抛出错误
 */
async function runListflow(uploadedFileId) {
    try {
        const API_KEY = ''; // 在 Dify「访问 API」里创建
        const USER = 'admin'; // 与你的工作流 user 一致
        const DIFY_HOST = ''; // 自建请换成对应域名

        const res = await fetch(`${DIFY_HOST}/v1/workflows/run`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: {
                    csv_file: {                      //'input_file'与工作流start里的输入变量名一致
                        transfer_method: 'local_file',
                        upload_file_id: uploadedFileId,
                        type: 'document'
                    }
                },
                user: USER,
                response_mode: 'blocking'
            })
        });
        if (!res.ok) throw new Error(`工作流运行失败: ${await res.text()}`);
        return await res.json(); // 直接返回结果
    } catch (error) {
        console.error('工作流错误:', error);
        alert('工作流执行失败，请检查控制台');
        throw error; // 继续向上抛出
    }
}

//工作流返回表格pdf折线图下载地址
/**
 * 运行PDF生成工作流
 * 根据选定的列和时间范围生成PDF图表
 * @async
 * @param {string} id - 任务ID
 * @param {string} stTime - 开始时间
 * @param {string} edTime - 结束时间
 * @param {Array<string>} col - 选择的列名数组
 * @returns {Promise<void>}
 * @throws {Error} 当工作流执行失败时抛出错误
 */
async function runPDFflow(id, stTime, edTime, col) {
    try {
        const API_KEY = ''; // 在 Dify「访问 API」里创建
        const USER = 'admin'; // 与你的工作流 user 一致
        const DIFY_HOST = ''; // 自建请换成对应域名

        //将数组转化为字符串并去除[]
        const cols = JSON.stringify(col)//.replace(/\[|\]/g, '');

        const res = await fetch(`${DIFY_HOST}/v1/workflows/run`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: {
                    task_id: id,                      //与工作流start里的输入变量名一致
                    col: cols,
                    start_time: stTime,
                    end_time: edTime
                },
                user: USER,
                response_mode: 'blocking'
            })
        });
        if (!res.ok) throw new Error(`工作流运行失败: ${await res.text()}`);
        const {data} = await res.json(); // 直接返回结果
        const {outputs: fileOutputs} = data;
        PDFOutputs = fileOutputs.pdf_url;
        console.log(PDFOutputs);
    } catch (error) {
        console.error('工作流错误:', error);
        alert('工作流执行失败，请检查控制台');
        throw error; // 继续向上抛出
    }
}

//删除后台的缓存文件id
/**
 * 运行删除工作流
 * 删除指定的任务缓存文件
 * @async
 * @param {string} taskId - 要删除的任务ID
 * @returns {Promise<void>}
 * @throws {Error} 当工作流执行失败时抛出错误
 */
async function runDropflow(taskId) {
    try {
        const API_KEY = ''; // 在 Dify「访问 API」里创建
        const USER = 'admin'; // 与你的工作流 user 一致
        const DIFY_HOST = ''; // 自建请换成对应域名

        const res = await fetch(`${DIFY_HOST}/v1/workflows/run`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: {
                    task_id: taskId                      //与工作流start里的输入变量名一致
                },
                user: USER,
                response_mode: 'blocking'
            })
        });
        if (!res.ok) throw new Error(`工作流运行失败: ${await res.text()}`);
        const result = await res.json(); // 直接返回结果
        console.log(result);  //打印返回结果
    } catch (error) {
        console.error('工作流错误:', error);
        alert('删除工作流执行失败，请检查控制台');
        throw error; // 继续向上抛出
    }
}

/**
 * 运行Python后端PDF生成服务
 * 使用Python后端生成PDF图表
 * @async
 * @param {string} id - 任务ID
 * @param {string} stTime - 开始时间
 * @param {string} edTime - 结束时间
 * @param {Array<string>} col - 选择的列名数组
 * @returns {Promise<void>}
 * @throws {Error} 当服务执行失败时抛出错误
 */
async function runPDFpy(id, stTime, edTime, col) {
    try {
        const API_KEY = ''; // 在 Dify「访问 API」里创建
        const USER = 'admin'; // 与你的工作流 user 一致
        const DIFY_HOST = ''; // 自建请换成对应域名

        //将数组转化为字符串并去除[]
        const cols = JSON.stringify(col)//.replace(/\[|\]/g, '');

        const res = await fetch(`${DIFY_HOST}:10600/pandas/plot`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                    task_id: id,                      //与工作流start里的输入变量名一致
                    col: cols,
                    start_time: stTime,
                    end_time: edTime,
                response_mode: 'blocking'
            })
        });
        if (!res.ok) throw new Error(`工作流运行失败: ${await res.text()}`);
        const {data} = await res.json(); // 直接返回结果
        console.log(data);
        PDFOutputs = data.output;
        console.log(PDFOutputs);
    } catch (error) {
        console.error('工作流错误:', error);
        alert('工作流执行失败，请检查控制台');
        throw error; // 继续向上抛出
    }
}

/**
 * 上传CSV文件到Python后端
 * 支持进度显示和取消功能
 * @async
 * @param {HTMLInputElement} fileInput - 文件输入元素
 * @returns {Promise<Object>} 上传结果数据
 * @throws {Error} 当上传失败时抛出错误
 */
async function uploadCsvFile(fileInput) {
    // 创建加载遮罩
    const overlay = document.createElement('div');
    overlay.style = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                backdrop-filter: blur(2px);
            `;

    // 创建进度条容器
    const progressContainer = document.createElement('div');
    progressContainer.style = `
                width: 80%;
                max-width: 400px;
                height: 20px;
                background: #f3f3f3;
                border-radius: 10px;
                overflow: hidden;
                margin-bottom: 20px;
            `;

    // 创建进度条
    const progressBar = document.createElement('div');
    progressBar.style = `
                width: 0%;
                height: 100%;
                background: #3498db;
                border-radius: 10px;
                transition: width 0.3s ease;
            `;

    progressContainer.appendChild(progressBar);

    const statusText = document.createElement('div');
    statusText.style = `
                color: white;
                font-size: 18px;
                margin-bottom: 20px;
                text-align: center;
            `;
    statusText.textContent = '文件上传中，请稍候... 0%';

    // 创建取消按钮
    const cancelBtn = document.createElement('button');
    cancelBtn.style = `
                padding: 8px 16px;
                background: #e74c3c;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            `;
    cancelBtn.textContent = '取消上传';

    overlay.appendChild(progressContainer);
    overlay.appendChild(statusText);
    overlay.appendChild(cancelBtn);
    document.body.appendChild(overlay);

    // 创建AbortController用于取消上传
    const controller = new AbortController();
    cancelBtn.onclick = () => {
        controller.abort();
        statusText.textContent = '上传已取消';
        progressContainer.style.display = 'none';
        cancelBtn.style.display = 'none';
        setTimeout(() => overlay.remove(), 2000);
    };

    const file = fileInput.files[0];
    if (!file) {
        console.error('请先选择文件');
        overlay.remove();
        return;
    }

    const formData = new FormData();
    formData.append('file', file, file.name);

    try {
        // 使用XMLHttpRequest来获取上传进度
        const xhr = new XMLHttpRequest();

        // 设置上传进度监听
        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                progressBar.style.width = `${percentComplete}%`;
                statusText.textContent = `文件上传中，请稍候... ${Math.round(percentComplete)}%`;
            }
        });

        // 创建Promise来处理XHR请求
        const uploadPromise = new Promise((resolve, reject) => {
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        resolve(data);
                    } catch (e) {
                        reject(new Error('响应解析失败'));
                    }
                } else {
                    reject(new Error(`服务器错误: ${xhr.status} ${xhr.statusText}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('网络错误，上传失败'));
            });

            xhr.addEventListener('abort', () => {
                reject(new Error('AbortError'));
            });

            xhr.open('POST', 'http://192.168.110.123:10600/pandas/read');
            xhr.setRequestHeader('accept', 'application/json');
            xhr.send(formData);
        });

        // 设置取消功能
        controller.signal.addEventListener('abort', () => {
            xhr.abort();
        });

        const data = await uploadPromise;
        console.log('上传成功:', data);

        // 更新状态显示
        statusText.textContent = '上传成功！';
        progressBar.style.background = '#2ecc71'; // 变成绿色表示成功

        // 在这里处理返回的数据
        const {result: fileOutputs} = data;
        listFileOutputs = fileOutputs;
        console.log(listFileOutputs);

        // 2秒后自动关闭
        setTimeout(() => overlay.remove(), 2000);
        return data;

    } catch (error) {
        if (error.message === 'AbortError') {
            console.log('上传已取消');
            return;
        }

        console.error('上传失败:', error);
        statusText.textContent = `上传失败: ${error.message}`;
        progressBar.style.background = '#e74c3c'; // 变成红色表示错误

        // 显示重试按钮
        const retryBtn = document.createElement('button');
        retryBtn.style = `
                    padding: 8px 16px;
                    background: #3498db;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-left: 10px;
                `;
        retryBtn.textContent = '重试';
        retryBtn.onclick = () => {
            overlay.remove();
            uploadCsvFile(fileInput);
        };

        cancelBtn.style.display = 'none';
        statusText.appendChild(retryBtn);

        // 10秒后自动关闭
        setTimeout(() => overlay.remove(), 10000);
    }
}

//处理excel转csv
/**
 * 读取Excel文件并转换为CSV格式
 * @async
 * @param {HTMLInputElement} fileInput - 文件输入元素
 * @returns {Promise<void>}
 * @throws {Error} 当转换失败时抛出错误
 */
async function readExcelFile(fileInput) {
    const API_KEY = ''; // 在 Dify「访问 API」里创建
    const USER = 'admin'; // 与你的工作流 user 一致
    const DIFY_HOST = ''; // 自建请换成对应域名

    const fd = new FormData();
    fd.append('file', fileInput); // 假设 fileId 是文件对象
    fd.append('user', USER);

    let uploadedFileId; // 在外部声明变量
    try {
        const res = await fetch(`${DIFY_HOST}/v1/files/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${API_KEY}` },
            body: fd
        });
        if (!res.ok) {
            throw new Error(`Request failed with status ${res.status}`);
        }
        const { id: dataId } = await res.json();
        uploadedFileId = dataId;
        console.log('✅ 上传成功，file_id =', dataId);
    } catch (error) {
        console.error('Error:', error);
        alert('上传失败，请检查文件格式或服务器状态');
        console.error('Error details:', error.message, error.stack);
    }
    //把 uploadedFileId 交给工作流继续处理
    const result = await runWorkflow(uploadedFileId);

}

/**
 * 运行Excel转换工作流
 * @async
 * @param {string} uploadedFileId - 已上传文件的ID
 * @returns {Promise<Object>} 工作流执行结果
 * @throws {Error} 当工作流执行失败时抛出错误
 */
async function runWorkflow(uploadedFileId) {
    try {
        const API_KEY = ''; // 在 Dify「访问 API」里创建
        const USER = 'admin'; // 与你的工作流 user 一致
        const DIFY_HOST = ''; // 自建请换成对应域名

        const res = await fetch(`${DIFY_HOST}/v1/workflows/run`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: {
                    excel_table: {                      //'input_file'与工作流start里的输入变量名一致
                        transfer_method: 'local_file',
                        upload_file_id: uploadedFileId,
                        type: 'document'
                    }
                },
                user: USER,
                response_mode: 'blocking'
            })
        });
        if (!res.ok) throw new Error(`工作流运行失败: ${await res.text()}`);
        return await res.json(); // 直接返回结果
    } catch (error) {
        console.error('工作流错误:', error);
        alert('工作流执行失败，请检查控制台');
        throw error; // 继续向上抛出
    }
}

/**
 * 从SQL数据库选择CSV文件
 * 支持进度显示和取消功能
 * @async
 * @param {string} filename - 要选择的文件名
 * @returns {Promise<Object>} 文件选择结果
 * @throws {Error} 当选择失败时抛出错误
 */
async function selectCsvFile(filename) {
    // 创建加载遮罩
    const overlay = document.createElement('div');
    overlay.style = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                backdrop-filter: blur(2px);
            `;

    // 创建进度条容器
    const progressContainer = document.createElement('div');
    progressContainer.style = `
                width: 80%;
                max-width: 400px;
                height: 20px;
                background: #f3f3f3;
                border-radius: 10px;
                overflow: hidden;
                margin-bottom: 20px;
            `;

    // 创建进度条
    const progressBar = document.createElement('div');
    progressBar.style = `
                width: 0%;
                height: 100%;
                background: #3498db;
                border-radius: 10px;
                transition: width 0.3s ease;
            `;

    progressContainer.appendChild(progressBar);

    const statusText = document.createElement('div');
    statusText.style = `
                color: white;
                font-size: 18px;
                margin-bottom: 20px;
                text-align: center;
            `;
    statusText.textContent = '文件加载中，请稍后... 0%';

    // 创建取消按钮
    const cancelBtn = document.createElement('button');
    cancelBtn.style = `
                padding: 8px 16px;
                background: #e74c3c;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            `;
    cancelBtn.textContent = '取消加载';

    overlay.appendChild(progressContainer);
    overlay.appendChild(statusText);
    overlay.appendChild(cancelBtn);
    document.body.appendChild(overlay);

    // 创建AbortController用于取消加载
    const controller = new AbortController();
    cancelBtn.onclick = () => {
        controller.abort();
        statusText.textContent = '加载已取消';
        progressContainer.style.display = 'none';
        cancelBtn.style.display = 'none';
        setTimeout(() => overlay.remove(), 2000);
    };

    try {
        const API_KEY = ''; // 在 Dify「访问 API」里创建
        const USER = 'admin'; // 与你的工作流 user 一致
        const DIFY_HOST = ''; // 自建请换成对应域名

        const res = await fetch(`${DIFY_HOST}/v1/workflows/run`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: {
                    file_name: filename
                },
                user: USER,
                response_mode: 'blocking'
            })
        });

        if (!res.ok) throw new Error(`工作流运行失败: ${await res.text()}`);

        // 模拟进度条动画
        const totalSteps = 100;
        const interval = 100; // 每100ms更新一次进度
        let currentStep = 0;

        const intervalId = setInterval(() => {
            if (currentStep >= totalSteps || controller.signal.aborted) {
                clearInterval(intervalId);
                return;
            }
            currentStep += 1;
            progressBar.style.width = `${currentStep}%`;
            statusText.textContent = `文件加载中，请稍后... ${currentStep}%`;
        }, interval);

        const { data } = await res.json(); // 直接返回结果
        const {outputs: fileOutputs} = data;
        const SQLRes = fileOutputs.meta;

        clearInterval(intervalId);
        progressBar.style.width = '100%';
        statusText.textContent = '文件加载成功！';
        progressBar.style.background = '#2ecc71'; // 变成绿色表示成功

        // 2秒后自动关闭
        setTimeout(() => overlay.remove(), 2000);

        return SQLRes;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('加载已取消');
            return;
        }

        console.error('工作流错误:', error);
        statusText.textContent = `加载失败: ${error.message}`;
        progressBar.style.background = '#e74c3c'; // 变成红色表示错误

        // 显示重试按钮
        const retryBtn = document.createElement('button');
        retryBtn.style = `
                    padding: 8px 16px;
                    background: #3498db;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-left: 10px;
                `;
        retryBtn.textContent = '重试';
        retryBtn.onclick = () => {
            overlay.remove();
            selectCsvFile(filename);
        };

        cancelBtn.style.display = 'none';
        statusText.appendChild(retryBtn);

        // 10秒后自动关闭
        setTimeout(() => overlay.remove(), 10000);
    }
}

/**
 * 导出模块函数
 * @namespace
 */
export {runPDFpy, listFileOutputs, PDFOutputs, runPDFflow,
    selectCsvFile, uploadCsvFile};

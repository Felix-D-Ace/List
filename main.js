/**
 * 导入外部模块和函数
 */
import { runPDFpy, listFileOutputs, runPDFflow, PDFOutputs, selectCsvFile, uploadCsvFile} from "./dify.js";
import {onFileNameChange} from "./fileSelect.js";
// ===== 数据与状态 =====
/**
 * 表格数据数组，存储文件/列信息
 * @type {Array<{name: string, time: string, selected: boolean}>}
 */
let tableData = [/*
    { name: "用户评论数据(mining)", time: "2024-01-15T10:00:00", selected: false },
    { name: "honghe_test_data0925(mining)", time: "2024-01-14T15:30:00", selected: false },
    { name: "1599486899654_copy(mining)", time: "2024-01-13T09:15:00", selected: false },
    { name: "用户行为数据分析(mining)", time: "2024-01-12T14:20:00", selected: false },
    { name: "商品销售统计表(mining)", time: "2024-01-11T11:45:00", selected: false }
*/];

/**
 * 任务ID
 * @type {string|undefined}
 */
let taskId;

/**
 * 后端返回的基础URL
 * @type {string|undefined}
 */
let backUrl;

/**
 * 是否为临时文件标志
 * @type {boolean}
 */
let isAscending = true;

/**
 * 过滤后的数据数组
 * @type {Array}
 */
let filteredData = [...tableData];

/**
 * 可用的时间范围数组
 * @type {Array}
 */
let availableTimes = [];

/**
 * 当前处理的文件
 * @type {string|undefined}
 */
let currentFile;

/**
 * 是否为临时文件的标志
 * @type {boolean}
 */
let isTmp;

/**
 * 原始文件名
 * @type {string|undefined}
 */
let originFile;

/**
 * 搜索关键词
 * @type {string}
 */
let searchKeyword = "";

/**
 * 开始时间
 * @type {string}
 */
let startTime = "";

/**
 * 结束时间
 * @type {string}
 */
let endTime = "";

/**
 * 结束时间限制
 * @type {string|undefined}
 */
let endLimitTime;

/**
 * 开始时间限制
 * @type {string|undefined}
 */
let startLimitTime;

// 独立的全量选中集合（用 name 作为唯一键；如可能重复，请改用唯一 id）
/**
 * 已选择文件名的集合（使用Set保证唯一性）
 * @type {Set<string>}
 */
const selectedNames = new Set();

/**
 * 从selectedNames中提取的名字数组
 * @type {Array<string>}
 */
let names; //取出selectedNames中的名字

let modelfileNames;

// ===== 初始化 =====
document.addEventListener("DOMContentLoaded", () => {

    // 事件绑定
    document.getElementById("uploadBtn").addEventListener("click", () => {
        document.getElementById("fileInput").click();
    });

    let fileInput = document.getElementById("fileInput");
    fileInput.addEventListener("change", async (e) => {
        try {
            const pythonRes = await uploadCsvFile(fileInput);
            console.log(pythonRes);
            handlePythonResult(pythonRes);

            //判断当前文件是否为缓存文件，不是则自动存入文件库中
            if ((originFile === null || originFile === undefined) && isTmp == false) {
                await runSQLFlow(currentFile);
                isTmp = true;
            }

        } catch (error) {
            console.error('上传文件错误:', error);
        } finally {
            e.target.value = "";
        }
    });

    // 处理python后端返回
    /**
     * 处理文件上传成功后的Python后端响应
     * @param {Object} pythonResult - Python后端返回的结果对象
     */
    function handlePythonResult(pythonResult) {
        if (!pythonResult) {
            console.error('Python返回为空:', pythonResult);
            alert("Python返回数据为空");
            return;
        }

        backUrl = pythonResult.url;
        taskId = pythonResult.task_id;
        isTmp = pythonResult.is_tmp;
        originFile = pythonResult.origin_fn;
        currentFile = pythonResult.file_name;
        const columns = pythonResult.result.columns || [];
        const index = pythonResult.result.index_range || [];
        console.log(index);

        tableData = columns.map(name => ({
            name,
            time: index[0] || "",
            selected: false
        }));


        // 刷新数据后，清理不存在于新数据里的已选项
        {
            const validNames = new Set(tableData.map(i => i.name));
            selectedNames.forEach(n => { if (!validNames.has(n)) selectedNames.delete(n); });
        }

        filteredData = [...tableData];

        // 仅调用设置时间范围（该函数无返回值，避免把 availableTimes 设为 undefined）
        setExternalTimeRange(index[0], index[1]);
        startLimitTime = index[0];
        endLimitTime = index[1];

        // 如需保留：可重新计算可用时间
        availableTimes = [...new Set(tableData.map(i => i.time))].sort();

        //显示当前操作的文件名
        document.getElementById("currentFile").innerText = currentFile;
        console.log(currentFile);

        renderFileList();
        updateSelectedCount();

    }

    document.getElementById("confirmBtn").addEventListener("click", confirmSelection);
    document.getElementById("searchInput").addEventListener("input", e => onSearchChange(e.target.value));
    document.getElementById("startTimeSelect").addEventListener("change", onTimeChange);
    document.getElementById("endTimeSelect").addEventListener("change", onTimeChange);
    document.getElementById("filterBtn").addEventListener("click", applyAllFilters);
    document.getElementById("clearBtn").addEventListener("click", clearAllFilters);
    document.getElementById("sortBtn").addEventListener("click", toggleSort);
    document.getElementById("selectAll").addEventListener("change", toggleSelectAll);
    document.getElementById('downloadBtn')?.addEventListener('click', () => {
        downloadFiles(backUrl);
    });

        renderFileList();
    updateSelectedCount();
    simulateFileUpload();
});

//模型处理完后下载表格
/**
 * 下载文件函数
 * @param {string} url - 文件下载链接
 */
async function downloadFiles(url) {
    try {
        if (!url) throw new Error('下载链接无效');
        console.log(url);

        const response = await fetch(url);
        if (!response.ok) throw new Error(`请求失败，状态码: ${response.status}`);

        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = blobUrl;
        link.download = url.split('/').pop() || 'download'; // 自动提取文件名
        document.body.appendChild(link);
        link.click();

        // 延迟释放资源
        setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        }, 500); // 适当延长确保下载完成
    } catch (error) {
        alert("下载失败：" + error.message);
    }
}

// 设置外部时间范围
/**
 * 设置外部时间范围限制
 * @param {string} externalStartTime - 外部开始时间
 * @param {string} externalEndTime - 外部结束时间
 */
function setExternalTimeRange(externalStartTime, externalEndTime) {
    const filterStartTimeInput = document.getElementById('startTimeSelect');
    const filterEndTimeInput = document.getElementById('endTimeSelect');

    filterStartTimeInput.min = externalStartTime;
    filterStartTimeInput.max = externalEndTime;

    filterEndTimeInput.min = externalStartTime;
    filterEndTimeInput.max = externalEndTime;

    filterStartTimeInput.value = externalStartTime;
    filterEndTimeInput.value = externalEndTime;

    filterStartTimeInput.onchange = function() {
        filterEndTimeInput.min = this.value;
        if (filterEndTimeInput.value && filterEndTimeInput.value <= this.value) {
            filterEndTimeInput.value = this.value;
        }
    };

    filterEndTimeInput.onchange = function() {
        filterStartTimeInput.max = this.value;
        if (filterStartTimeInput.value && filterStartTimeInput.value >= this.value) {
            filterStartTimeInput.value = this.value;
        }
    };
}

// ===== 虚拟滚动类 =====
/**
 * 文件列表虚拟滚动组件类
 * 用于优化大量文件列表的渲染性能
 */
class FileListVirtualScroll {
    /**
     * 构造函数
     * @param {HTMLElement} container - 容器元素
     * @param {Object} options - 配置选项
     * @param {number} [options.itemHeight=50] - 每个列表项的高度
     */
    constructor(container, options = {}) {
        this.container = container;
        // 重要修复：传入的就是 #fileListContainer 本身，不能再 querySelector
        this.fileListContainer = container;
        this.itemHeight = options.itemHeight || 50; // 每个列表项的高度
        this.scrollTop = 0;
        this.startIndex = 0;
        this.endIndex = 0;
        this.data = [];
        this.selectedNamesRef = null; // 保存选中集合引用
        // 不在构造函数中初始化，而是提供一个手动初始化方法
    }

    // 手动初始化方法
    /**
     * 初始化虚拟滚动组件
     * @returns {boolean} 初始化是否成功
     */
    initialize() {
        if (!this.fileListContainer) {
            console.error('无法找到 #fileListContainer 元素');
            return false;
        }

        this.setupContainer();
        this.setupScrollListener();
        return true;
    }

    /**
     * 设置容器样式和滚动监听
     */
    setupContainer() {
        // 设置容器样式
        this.fileListContainer.style.position = 'relative';
        this.fileListContainer.style.overflow = 'auto';
        this.fileListContainer.style.height = '400px'; // 设置固定高度

        // 计算可见项数量
        this.visibleCount = Math.ceil(this.fileListContainer.clientHeight / this.itemHeight);

        // 创建虚拟滚动内容容器
        this.virtualContent = document.createElement('div');
        this.virtualContent.className = 'virtual-content';
        this.virtualContent.style.position = 'relative';
        this.fileListContainer.appendChild(this.virtualContent);
    }

    /**
     * 设置滚动事件监听
     */
    setupScrollListener() {
        // 滚动事件监听
        this.fileListContainer.addEventListener('scroll', () => {
            this.handleScroll();
        });
    }

    /**
     * 处理滚动事件，计算需要渲染的项
     */
    handleScroll() {
        if (!this.virtualContent) return;

        const scrollTop = this.fileListContainer.scrollTop;
        this.scrollTop = scrollTop;

        // 计算需要渲染的索引范围
        const newStartIndex = Math.floor(scrollTop / this.itemHeight);
        const newEndIndex = Math.min(newStartIndex + this.visibleCount + 2, this.totalCount);

        // 只有当索引范围发生变化时才重新渲染
        if (newStartIndex !== this.startIndex || newEndIndex !== this.endIndex) {
            this.startIndex = newStartIndex;
            this.endIndex = newEndIndex;
            // 使用内部数据与选中集合引用
            this.render();
        }
    }

    // data/selectedNames 参数可选；不传则使用内部引用
    /**
     * 渲染文件列表项
     * @param {Array} data - 要渲染的数据数组
     * @param {Set<string>} selectedNames - 已选择的项目名称集合
     */
    render(data, selectedNames) {
        if (data) this.data = data;
        if (selectedNames) this.selectedNamesRef = selectedNames;

        if (!this.data || this.data.length === 0 || !this.virtualContent) return;

        this.totalCount = this.data.length;

        // 根据当前滚动位置计算应显示的索引范围（含少量 overscan）
        const startIndex = Math.floor(this.scrollTop / this.itemHeight);
        const endIndex = Math.min(startIndex + this.visibleCount + 2, this.totalCount);

        this.startIndex = startIndex;
        this.endIndex = endIndex;

        // 设置整体高度并渲染可见区
        this.virtualContent.style.height = `${this.totalCount * this.itemHeight}px`;
        this.virtualContent.innerHTML = '';

        for (let i = startIndex; i < endIndex; i++) {
            const fileItem = this.createFileItem(this.data[i], i);
            this.virtualContent.appendChild(fileItem);
        }
    }

    /**
     * 创建单个文件列表项元素
     * @param {Object} item - 文件项数据
     * @param {number} index - 项索引
     * @returns {HTMLElement} 列表项DOM元素
     */
    createFileItem(item, index) {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.style.position = 'absolute';
        div.style.top = `${index * this.itemHeight}px`;
        div.style.height = `${this.itemHeight}px`;
        div.style.width = '100%';
        div.style.boxSizing = 'border-box';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        const isChecked = this.selectedNamesRef ? this.selectedNamesRef.has(item.name) : false;
        checkbox.checked = isChecked;
        checkbox.addEventListener('change', () => {
            toggleItem(index); // 直接复用你现有的选择逻辑
        });
        div.appendChild(checkbox);

        const span = document.createElement('span');
        span.textContent = item.name;
        div.appendChild(span);

        return div;
    }

    // 更新选中状态
    /**
     * 更新选中状态
     * @param {Set<string>} selectedNames - 已选择的项目名称集合
     */
    updateSelection(selectedNames) {
        if (!this.virtualContent) return;

        const checkboxes = this.virtualContent.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach((checkbox, index) => {
            const actualIndex = this.startIndex + index;
            if (actualIndex < this.totalCount) {
                const item = this.data[actualIndex];
                if (item) {
                    checkbox.checked = selectedNames.has(item.name);
                }
            }
        });
        names = Array.from(selectedNames);
        console.log(names);
    }

    // 设置数据引用
    /**
     * 设置数据引用
     * @param {Array} data - 数据数组
     */
    setData(data) {
        this.data = data;
    }

    // 保存选中集合引用
    /**
     * 保存选中集合引用
     * @param {Set<string>} ref - 选中名称集合引用
     */
    setSelectedNamesRef(ref) {
        this.selectedNamesRef = ref;
    }
}

// 全局虚拟滚动实例
let virtualScroll;

// ===== 文件与时间列（模拟）=====
/**
 * 模拟文件上传过程
 */
function simulateFileUpload() {
    availableTimes = [...new Set(tableData.map(i => i.time))].sort();
}

// ===== 交互：搜索与时间选择 =====
/**
 * 处理搜索输入变化
 * @param {string} keyword - 搜索关键词
 */
function onSearchChange(keyword) {
    searchKeyword = keyword.trim();
    applyAllFilters();
}

/**
 * 处理时间选择变化
 */
function onTimeChange() {
    startTime = document.getElementById("startTimeSelect").value;
    endTime = document.getElementById("endTimeSelect").value;
    // 等用户点"应用筛选"统一执行
}

/**
 * 应用所有过滤器
 */
function applyAllFilters() {
    let result = [...tableData];

    if (searchKeyword) {
        const kw = searchKeyword.toLowerCase();
        const regex = new RegExp(kw, 'i');
        result = result.filter(item => regex.test(item.name.toLowerCase()));
    }

    if (startTime && endTime) {
        const s = new Date(startTime);
        const e = new Date(endTime);
        result = result.filter(item => {
            const t = new Date(item.time);
            return t >= s && t <= e;
        });
    }

    filteredData = result;
    renderFileList();
    updateSelectedCount();
}

/**
 * 清除所有过滤器
 */
function clearAllFilters() {
    document.getElementById("searchInput").value = "";
    document.getElementById("startTimeSelect").value = "";
    document.getElementById("endTimeSelect").value = "";
    searchKeyword = "";
    startTime = "";
    endTime = "";

    // 不清空 selectedNames，保持勾选状态
    filteredData = [...tableData];
    renderFileList();
    updateSelectedCount();
}

// ===== 列表与选择 =====
function renderFileList() {
    const container = document.getElementById("fileListContainer");

    // 检查容器是否存在
    if (!container) {
        console.error('fileListContainer 元素不存在');
        return;
    }

    // 初始化或更新虚拟滚动
    if (!virtualScroll) {
        virtualScroll = new FileListVirtualScroll(container, { itemHeight: 50 });
        if (!virtualScroll.initialize()) {
            // 初始化失败，使用传统渲染
            renderFileListTraditional();
            return;
        }
    }

    // 更新数据与选中集合引用，并渲染
    virtualScroll.setData(filteredData);
    virtualScroll.setSelectedNamesRef(selectedNames);
    // 确保从顶部开始（可按需取消）
    container.scrollTop = 0;
    virtualScroll.scrollTop = 0;
    virtualScroll.render();
}

/**
 * 切换单项选择状态
 * @param {number} index - 项目索引
 */
function toggleItem(index) {
    const item = filteredData[index];
    if (!item) return;

    if (selectedNames.has(item.name)) {
        selectedNames.delete(item.name);
    } else {
        selectedNames.add(item.name);
    }

    // 更新虚拟滚动的选中状态
    if (virtualScroll) {
        virtualScroll.updateSelection(selectedNames);
    }

    updateSelectedCount();
}

/**
 * 切换全选状态
 */
function toggleSelectAll() {
    const checked = document.getElementById("selectAll").checked;
    if (checked) {
        filteredData.forEach(item => selectedNames.add(item.name));
    } else {
        filteredData.forEach(item => selectedNames.delete(item.name));
    }

    // 更新虚拟滚动的选中状态
    if (virtualScroll) {
        virtualScroll.updateSelection(selectedNames);
    }

    updateSelectedCount();
}

/**
 * 更新已选择项目数量显示
 */
function updateSelectedCount() {
    const count = selectedNames.size;
    document.getElementById("selectedCount").textContent = `已选择 ${count} 项`;
}

// ===== 排序与操作 =====
/**
 * 切换排序状态
 */
function toggleSort() {
    isAscending = !isAscending;
    document.getElementById("sortIcon").textContent = isAscending ? "↑" : "↓";
    filteredData.sort((a, b) =>
        isAscending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    );
    renderFileList();
}

/**
 * 确认选择并执行后续操作
 */
async function confirmSelection() {
    console.log(selectedNames);
    if (names.length === 0) {
        alert("请至少选择一个列名");
        return;
    }

    if (names.length >= 500) {
        alert("选择的列名数量不能超过 500");
        return;
    }

    if (endTime && startTime && new Date(endTime) <= new Date(startTime)) {
        alert("结束时间必须大于开始时间！");
        return;
    }

    if (!startTime) startTime = startLimitTime;
    if (!endTime) endTime = endLimitTime;

    //await runPDFflow(taskId, startTime, endTime, names);
    await runPDFpy(taskId, startTime, endTime, names);

    await onPreviewAndOpen(PDFOutputs);

    const info = [];
    if (searchKeyword) info.push(`关键字：${searchKeyword}`);
    if (startTime && endTime)
        info.push(`时间范围：${formatDateTime(startTime)} 至 ${formatDateTime(endTime)}`);

    document.getElementById("contentArea").innerHTML = `
    <div style="padding:20px;">
      <h3>已选择的列名：</h3>
      ${names.map(n => `<p>• ${n}</p>`).join("")}
      ${info.length ? `<hr/><p><strong>筛选条件：</strong></p>${info.map(i => `<p>• ${i}</p>`).join("")}` : ""}
    </div>`;
    renderFileList();
    updateSelectedCount();
}

// ===== 工具 =====
/**
 * 格式化日期时间显示
 * @param {string} str - 日期时间字符串
 * @returns {string} 格式化后的日期时间
 */
function formatDateTime(str) {
    return new Date(str).toLocaleString("zh-CN");
}

//查看pdf图
/**
 * 预览PDF文件
 * @param {string} PDFOutput - PDF文件的URL或响应数据
 */
async function onPreviewAndOpen(PDFOutput) {
    try {
        if (!PDFOutput) return alert('下载链接无效')
        else alert('pdf加载成功，预览pdf时如被浏览器拦截，请阻止该拦截保证功能的正常使用');

        const resp = await fetch(PDFOutput, {
            credentials: 'omit'
        });

        if (!resp.ok) throw new Error(`请求失败，状态码: ${resp.status}`);

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);

        const win = window.open(url, '_blank');
        if (!win) {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        const cleanup = () => {
            try { URL.revokeObjectURL(url); } catch {}
            window.removeEventListener('beforeunload', beforeUnloadHandler);
            clearInterval(watcher);
        };

        const beforeUnloadHandler = () => cleanup();
        window.addEventListener('beforeunload', beforeUnloadHandler);

        const watcher = setInterval(() => {
            if (!win || win.closed) cleanup();
        }, 800);

    } catch (e) {
        alert('预览失败：' + e.message);
    }
}

//检查是否是一个下载地址
/**
 * 检查给定的URL是否是一个下载地址
 *
 * 该函数通过检查URL格式和常见下载文件扩展名来判断是否为下载地址
 *
 * @param {string} url - 要检查的URL字符串
 * @returns {boolean} 如果URL符合下载地址格式则返回true，否则返回false
 *
 * @example
 * // 返回 true
 * isDownloadUrl('http://example.com/file.zip');
 *
 * @example
 * // 返回 false
 * isDownloadUrl('http://example.com/page.html');
 */
function isDownloadUrl(url) {
    // 基础URL格式验证
    const urlPattern = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;

    // 常见下载文件扩展名
    const downloadExtensions = /\.(pdf|csv?|xlsx?|zip|rar|7z|tar\.gz|exe|dmg|apk|mp3|mp4|avi|mov|jpg|jpeg|png|gif)$/i;

    return urlPattern.test(url) && downloadExtensions.test(url);
}

// 处理dify提交后端返回
/**
 * 处理Dify后端返回的结果
 * @param {Object} difyResult - Dify后端返回的结果
 */
async function handleDifyResult(difyResult) {
    //检查difyResult是不是一个下载地址
    console.log(difyResult);
    if (isDownloadUrl(difyResult)) {
        await downloadFiles(difyResult);
        return;
    }

    const difyRes = JSON.parse(difyResult);
    console.log(difyRes);
    if (!difyRes) {
        console.error('Dify返回为空:', difyRes);
        alert("Dify返回数据为空");
        return;
    }

    taskId = difyRes.task_id;
    backUrl = difyRes.url;
    isTmp = difyRes.is_tmp;
    originFile = difyRes.origin_fn;
    currentFile = difyRes.file_name;
    const columns = difyRes.result.columns || [];
    const index = difyRes.result.index_range || [];
    console.log(index);

    tableData = columns.map(name => ({
        name,
        time: index[0] || "",
        selected: false
    }));


    // 刷新数据后，清理不存在于新数据里的已选项
    {
        const validNames = new Set(tableData.map(i => i.name));
        selectedNames.forEach(n => { if (!validNames.has(n)) selectedNames.delete(n); });
    }

    filteredData = [...tableData];

    // 仅调用设置时间范围（该函数无返回值，避免把 availableTimes 设为 undefined）
    setExternalTimeRange(index[0], index[1]);
    startLimitTime = index[0];
    endLimitTime = index[1];

    // 如需保留：可重新计算可用时间
    availableTimes = [...new Set(tableData.map(i => i.time))].sort();

    renderFileList();
    updateSelectedCount();
    document.getElementById("currentFile").innerHTML = currentFile;

}

async function loadFiles() {
    try {
        const API_KEY = ''; // 在 Dify「访问 API」里创建
        const USER = 'admin'; // 与你的工作流 user 一致
        const DIFY_HOST = ''; // 自建请换成对应域名
        const response = await fetch(`${DIFY_HOST}/v1/workflows/run`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: {},
                user: USER,
                response_mode: 'blocking'
            })
        });

        const responseData = await response.json();
        console.log("完整响应数据:", responseData); // 调试用

        // 关键修改：从 data.outputs 中获取 files_meta
        if (responseData.data?.outputs?.files_meta) {
            try {
                // 修复JSON字符串格式
                const fixedJson = responseData.data.outputs.files_meta

                const meta = JSON.parse(fixedJson);
                console.log("解析后的文件元数据:", meta); // 调试用

                // 转换为前端需要的对象数组
                const allFiles = meta.name.map((name, index) => ({
                    name: name,
                    size: meta.size?.[index] || 'N/A',
                    modified: meta.modified?.[index] || 'N/A'
                }));

                console.log("转换后的文件列表:", allFiles); // 调试用
                //取出所有后端返回的文件名
                const mfn = allFiles.map(file => file.name);
                console.log(mfn);
                return mfn;
            } catch (parseError) {
                console.error("解析files_meta失败:", parseError);
            }
        }
    } catch (error) {
        console.error("请求失败:", error);
    }
}

/**
 * 传统的文件列表渲染方法（非虚拟滚动）
 */
function renderFileListTraditional() {
    const container = document.getElementById("fileListContainer");
    if (!container) return;

    container.innerHTML = "";
    filteredData.forEach((item, idx) => {
        const div = document.createElement("div");
        div.className = "list-item";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = selectedNames.has(item.name);
        checkbox.addEventListener("change", () => toggleItem(idx));
        div.appendChild(checkbox);

        const span = document.createElement("span");
        span.textContent = item.name;
        div.appendChild(span);

        container.appendChild(div);
    });
}

//原module.js文件代码
// 全局变量保存原始数据

let originalModelData = null;
let selectedModel = null;
let selectedModelApiUrl = null; // 存储当前选中模型的API URL
let previewPDFUrl = null; //存储模型处理的pdf预览图地址接口
let prePDFOutputs;
let submitOutputs;

// ===== 模型选择相关功能 =====
/**
 * 模块选择功能（弹窗选择模型）
 */
document.getElementById('moduleBtn').addEventListener('click', modSelect);

async function modSelect() {
    try {
        if (!startTime) startTime = startLimitTime;
        if (!endTime) endTime = endLimitTime;
        modelfileNames = await loadFiles();
        console.log(modelfileNames);
        // 1. 创建弹窗容器
        const modArea = document.createElement("div");
        modArea.className = "modal-container";

        // 2. 创建标题
        const title = document.createElement("h3");
        title.className = "modal-title";
        title.textContent = "模型选择";
        modArea.appendChild(title);

        // 3. 创建关闭按钮
        const closeBtn = document.createElement("button");
        closeBtn.className = "modal-close-btn";
        closeBtn.textContent = "×";
        closeBtn.id = "closeBtn";
        modArea.appendChild(closeBtn);

        // 4. 创建内容容器（Flex 布局）
        const content = document.createElement("div");
        content.className = "modal-content";

        // 5. 创建左侧输入区域（selectArea）
        const selectArea = document.createElement("div");
        selectArea.className = "modal-panel";
        selectArea.id = "selectArea";

        const input = document.createElement("input");
        input.className = "modal-input";
        input.id = "moduleInput";
        input.type = "text";
        input.placeholder = "输入关键字搜索模型";
        selectArea.appendChild(input);

        // 创建模型列表容器
        const modelList = document.createElement("div");
        modelList.className = "model-list";

        // 创建虚拟滚动容器
        const virtualScroll = document.createElement("div");
        virtualScroll.className = "virtual-scroll";
        modelList.appendChild(virtualScroll);
        selectArea.appendChild(modelList);

        // 6. 创建右侧模块区域（moduleArea）
        const moduleArea = document.createElement("div");
        moduleArea.className = "modal-panel";
        moduleArea.id = "moduleArea";

        //创建按钮区域
        const buttonGroup = document.createElement("div");
        buttonGroup.className = "button-group";
        buttonGroup.id = "moduleButtonGroup";

        // 参数容器
        const paramContainer = document.createElement("div");
        paramContainer.className = "param-container";
        moduleArea.appendChild(paramContainer);

        //预览按钮
        const previewBtn = document.createElement("button");
        previewBtn.className = "submit-btn";
        previewBtn.textContent = "预览pdf";
        buttonGroup.appendChild(previewBtn);

        // 提交按钮
        const submitBtn = document.createElement("button");
        submitBtn.className = "submit-btn";
        submitBtn.textContent = "执行";
        buttonGroup.appendChild(submitBtn);

        //6.5将按钮添加进按钮模块里，再加进容器里
        moduleArea.appendChild(buttonGroup);

        // 7. 将左右面板添加到内容容器
        content.appendChild(selectArea);
        content.appendChild(moduleArea);

        // 8. 将内容容器添加到弹窗
        modArea.appendChild(content);

        // 9. 添加到页面
        document.body.appendChild(modArea);

        // 10. 加载 CSS 文件（如果还没加载）
        const existingStyles = document.querySelector('link[href="styles.css"]');
        if (!existingStyles) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "stystles.css";
            document.head.appendChild(link);
        }

        // 11. 关闭按钮事件
        closeBtn.addEventListener("click", () => {
            document.body.removeChild(modArea);
        });

        // 12. 初始化数据
        originalModelData = getMockData();

        // 13. 添加示例说明（测试）
        /*let a = `
        1. 在左侧列表中选择一个模型，如 <span class="example-model">示例模型</span><br>
        2. 在右侧填写对应的参数值<br>
        3. 点击"提交"按钮完成操作
        `;
        addExampleSection(a);*/

        // 14. 初始渲染模型列表
        renderModelList(originalModelData);

        // 15. 搜索功能（添加防抖）
        let searchTimeout;
        input.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const searchTerm = e.target.value.toLowerCase();
                if (searchTerm === '') {
                    // 搜索框为空时恢复完整列表
                    renderModelList(originalModelData);
                    return;
                }

                const filteredModels = Object.keys(originalModelData).filter(model =>
                    model.toLowerCase().includes(searchTerm)
                );
                const filteredData = {};
                filteredModels.forEach(model => {
                    filteredData[model] = originalModelData[model];
                });
                renderModelList(filteredData);
            }, 300);
        });

        // 16. 提交功能
        submitBtn.addEventListener('click', async() => {
            try {
                if (!selectedModel) {
                    alert('请先选择一个模型');
                    return;
                }

                const params = {};
                const inputs = paramContainer.querySelectorAll('.param-input');
                const paramNames = Object.keys(originalModelData[selectedModel].parameters);

                paramNames.forEach((param, index) => {
                    params[param] = inputs[index].value;
                });

                if (names.length === 0) {
                    alert("请至少选择一个列名");
                    return;
                }

                if (names.length >= 500) {
                    alert("选择的列名数量不能超过 500");
                    return;
                }

                await submitFlow(taskId, params, selectedModelApiUrl, names);
                await handleDifyResult(submitOutputs);
                alert('表格处理完毕');
                document.body.removeChild(modArea);
                renderFileList();
                updateSelectedCount();

            } catch (error) {
                console.error("提交失败：" + error.message);
                alert('提交失败: ' + error.message);
            }
        });

        //17. 预览功能
        previewBtn.addEventListener('click', async() => {
            if (!selectedModel) {
                alert('请先选择一个模型');
                return;
            }

            const params = {};
            const inputs = paramContainer.querySelectorAll('.param-input');
            const paramNames = Object.keys(originalModelData[selectedModel].parameters);

            paramNames.forEach((param, index) => {
                params[param] = inputs[index].value;
            });

            if (names.length === 0) {
                alert("请至少选择一个列名");
                return;
            }

            if (names.length >= 500) {
                alert("选择的列名数量不能超过 500");
                return;
            }

            await previewFlow(taskId, params, previewPDFUrl, names);
            await onPreviewAndOpen(prePDFOutputs);
        })

        // 渲染模型列表函数
        /**
         * 渲染模型列表到虚拟滚动容器中
         *
         * 该函数根据提供的数据创建模型列表项，并为每个项添加点击事件处理。
         * 点击模型项时会更新选中状态、按钮文本、API URL等信息，并渲染参数区域。
         *
         * @param {Object} data - 模型数据对象，键为模型名称，值为包含模型信息的对象
         * @param {string} data[].api_url - 模型的API接口URL
         * @param {string} data[].preview_url - 模型的预览URL
         * @param {string} data[].state - 模型的状态说明
         * @param {Object} data[].parameters - 模型的参数配置对象
         *
         * @returns {void}
         *
         * @example
         * // 示例数据格式
         * const modelData = {
         *   "模型1": {
         *     api_url: "/api/model1",
         *     preview_url: "/preview/model1",
         *     state: "模型1说明",
         *     parameters: { param1: "value1" }
         *   },
         *   "模型2": {
         *     api_url: "/api/model2",
         *     preview_url: "/preview/model2",
         *     state: "模型2说明",
         *     parameters: { param2: "value2" }
         *   }
         * };
         * renderModelList(modelData);
         */
        function renderModelList(data) {
            virtualScroll.innerHTML = '';

            const models = Object.keys(data);
            if (models.length === 0) {
                virtualScroll.innerHTML = '<div class="no-results">没有找到匹配的模型</div>';
                return;
            }

            models.forEach(model => {
                const modelItem = document.createElement("div");
                modelItem.className = "model-item";
                modelItem.textContent = model;

                modelItem.addEventListener('click', () => {
                    // 移除之前选中的样式
                    const prevSelected = virtualScroll.querySelector('.active');
                    if (prevSelected) {
                        prevSelected.classList.remove('active');
                    }

                    // 添加当前选中的样式
                    modelItem.classList.add('active');
                    selectedModel = model;
                    if (selectedModel === '相关性分析') {
                        submitBtn.textContent = '下载报表';
                    } else {
                        submitBtn.textContent = '执行';
                    }
                    selectedModelApiUrl = data[model].api_url; // 存储API URL
                    previewPDFUrl = data[model].preview_url; // 存储当前选中模型的预览URL
                    const state = data[model].state; //添加模型说明
                    addExampleSection(state);

                    // 渲染参数区域
                    console.log(data[model].parameters);
                    renderParameters(model, data[model].parameters);
                });

                virtualScroll.appendChild(modelItem);
            });
        }

        // 渲染参数区域函数
        /**
         * 渲染模型参数区域
         *
         * 该函数根据模型名称和参数配置对象，在参数容器中创建参数输入界面。
         * 每个参数包含标签和文本输入框，支持数组类型参数的逗号分隔显示。
         *
         * @param {string} modelName - 模型名称，用于显示在参数区域标题中
         * @param {Object} parameters - 参数配置对象，键为参数名，值为参数配置对象
         * @param {string} parameters[].state - 参数的状态说明或描述
         * @param {*} parameters[].value - 参数的默认值，可以是字符串、数字、数组等类型
         *
         * @returns {void}
         *
         * @example
         * // 示例参数数据
         * const params = {
         *   "learning_rate": {
         *     state: "学习率，控制模型训练步长",
         *     value: 0.01
         *   },
         *   "features": {
         *     state: "特征列名",
         *     value: ["age", "income"]
         *   }
         * };
         * renderParameters("线性回归", params);
         */
        function renderParameters(modelName, parameters) {
            paramContainer.innerHTML = '';

            const title = document.createElement("h4");
            title.textContent = `模型参数: ${modelName}`;
            paramContainer.appendChild(title);

            Object.entries(parameters).forEach(([param, defaultValue]) => {
                const paramItem = document.createElement("div");
                paramItem.className = "param-item";

                const label = document.createElement("label");
                label.className = "param-name";
                label.textContent = param + '(' + defaultValue.state + ')';
                paramItem.appendChild(label);

                // 特殊处理 CCF_HDMR 模型的特定参数
                if (modelName === 'CCF_HDMR' && isDropdownParam(param)) {
                    // 创建虚拟滚动下拉框（带全选）
                    console.log(defaultValue);
                    createVirtualSelect(param, defaultValue, paramItem);
                } else {
                    // 默认文本输入框
                    const input = document.createElement("input");
                    input.className = "param-input";
                    input.type = "text";
                    input.value = formatDefaultValue(defaultValue.value);
                    paramItem.appendChild(input);
                }

                paramContainer.appendChild(paramItem);
            });
        }

// 判断是否需要下拉框的辅助函数
        function isDropdownParam(param) {
            const dropdownParams = ["x_names", "y_name", "test_csv"];
            return dropdownParams.includes(param);
        }

// 格式化默认值为字符串
        function formatDefaultValue(value) {
            return Array.isArray(value) ? value.join(',') : value.toString();
        }

// 创建虚拟滚动下拉框（带全选）
        function createVirtualSelect(param, defaultValue, container) {
            const selectWrapper = document.createElement("div");
            selectWrapper.className = "virtual-select-wrapper";

            // 下拉框触发按钮（显示已选项）
            const selectButton = document.createElement("button");
            selectButton.className = "select-button";
            selectButton.textContent = "点击选择列名";
            selectWrapper.appendChild(selectButton);

            // 下拉框容器（虚拟滚动区域）
            const dropdown = document.createElement("div");
            dropdown.className = "select-dropdown";
            dropdown.style.display = "none"; // 默认隐藏

            // 动态生成选项（假设 defaultValue.value 是可选值数组）
            const checkboxes = [];
            const options = defaultValue.value instanceof Set
                ? Array.from(defaultValue.value)
                : [];
            console.log(defaultValue.value);

            // 如果是 y_name 参数，使用单选逻辑（radio）
            if (param === 'y_name') {
                options.forEach(option => {
                    const item = document.createElement("div");
                    item.className = "select-item";

                    const radio = document.createElement("input");
                    radio.type = "radio";
                    radio.name = `radio-group-${param}`; // 相同的 name 确保单选
                    radio.id = `opt-${param}-${option}`;
                    radio.value = option;

                    // 如果当前选项是默认值，设置为选中
                    if (option === defaultValue.value) {
                        radio.checked = true;
                    }

                    const label = document.createElement("label");
                    label.htmlFor = `opt-${param}-${option}`;
                    label.textContent = option;

                    item.appendChild(radio);
                    item.appendChild(label);
                    dropdown.appendChild(item);
                });
            }
            // 如果是 x_names 参数，使用多选逻辑（checkbox + 全选）
            else if (param === 'x_names') {
                // 全选复选框
                const selectAllItem = document.createElement("div");
                selectAllItem.className = "select-item";

                const selectAllCheckbox = document.createElement("input");
                selectAllCheckbox.type = "checkbox";
                selectAllCheckbox.id = `select-all-${param}`;
                selectAllCheckbox.addEventListener("change", (e) => {
                    const isChecked = e.target.checked;
                    checkboxes.forEach(cb => cb.checked = isChecked);
                });

                const selectAllLabel = document.createElement("label");
                selectAllLabel.htmlFor = `select-all-${param}`;
                selectAllLabel.textContent = "全选";

                selectAllItem.appendChild(selectAllCheckbox);
                selectAllItem.appendChild(selectAllLabel);
                dropdown.appendChild(selectAllItem);

                // 生成多选选项
                options.forEach(option => {
                    const item = document.createElement("div");
                    item.className = "select-item";

                    const checkbox = document.createElement("input");
                    checkbox.type = "checkbox";
                    checkbox.id = `opt-${param}-${option}`;
                    checkbox.value = option;
                    checkboxes.push(checkbox);

                    // 如果默认值包含当前选项，设置为选中
                    if (defaultValue.value instanceof Set && defaultValue.value.has(option)) {
                        checkbox.checked = true;
                    } else if (Array.isArray(defaultValue.value) && defaultValue.value.includes(option)) {
                        checkbox.checked = true;
                    }

                    const label = document.createElement("label");
                    label.htmlFor = `opt-${param}-${option}`;
                    label.textContent = option;

                    item.appendChild(checkbox);
                    item.appendChild(label);
                    dropdown.appendChild(item);
                });
            }
            // 如果是 test_csv 参数，使用单选逻辑（radio）
            else if (param === 'test_csv') {
                options.forEach(option => {
                    const item = document.createElement("div");
                    item.className = "select-item";

                    const radio = document.createElement("input");
                    radio.type = "radio";
                    radio.name = `radio-group-${param}`; // 相同的 name 确保单选
                    radio.id = `opt-${param}-${option}`;
                    radio.value = option;

                    // 如果当前选项是默认值，设置为选中
                    if (option === defaultValue.value) {
                        radio.checked = true;
                    }

                    const label = document.createElement("label");
                    label.htmlFor = `opt-${param}-${option}`;
                    label.textContent = option;

                    item.appendChild(radio);
                    item.appendChild(label);
                    dropdown.appendChild(item);
                });
            }

            // 点击按钮显示/隐藏下拉框
            selectButton.addEventListener("click", () => {
                dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
            });

            // 点击外部关闭下拉框
            document.addEventListener("click", (e) => {
                if (!selectWrapper.contains(e.target)) {
                    dropdown.style.display = "none";
                }
            });

            // 添加一个函数来获取当前选中的值
            function getSelectedValues() {
                const selectedValues = {};
                const inputs = dropdown.querySelectorAll(`input[type="radio"], input[type="checkbox"]`);

                inputs.forEach(input => {
                    if (input.checked) {
                        if (!selectedValues[param]) {
                            selectedValues[param] = [];
                        }
                        selectedValues[param].push(input.value);
                    }
                });

                // 如果是单选逻辑，只保留一个值
                if (param === 'y_name' || param === 'test_csv') {
                    selectedValues[param] = selectedValues[param][0];
                }

                return selectedValues;
            }

            // 将获取选中值的函数绑定到 selectWrapper 上
            selectWrapper.getSelectedValues = getSelectedValues;

            selectWrapper.appendChild(dropdown);
            container.appendChild(selectWrapper);
        }

        // 添加示例说明函数（只执行一次）
        function addExampleSection(explain) {
            console.log(explain);
            // 检查是否已经存在示例说明
            const existingSection = selectArea.querySelector('.example-section');
            if (existingSection) {
                existingSection.remove(); // 删除已存在的示例说明
            }

            const exampleSection = document.createElement("div");
            exampleSection.className = "example-section";

            const title = document.createElement("h4");
            title.className = "example-title";
            title.textContent = "模型说明";
            exampleSection.appendChild(title);

            const desc = document.createElement("p");
            // 使用模板字符串正确插入变量
            desc.innerHTML = `${explain}`;
            exampleSection.appendChild(desc);

            selectArea.appendChild(exampleSection);
        }

        // 默认选择示例模型
        setTimeout(() => {
            const exampleModel = virtualScroll.querySelector('.model-item');
            if (exampleModel) {
                exampleModel.click();
            }
        }, 0);

    } catch (e) {
        console.error(e);
    }

    //预览后端交互
    async function previewFlow(id, parameter, API_KEY, cols) {
        try {
            const USER = 'admin'; // 与你的工作流 user 一致
            const DIFY_HOST = ''; // 自建请换成对应域名

            //将数组转化为字符串并去除[]
            const params = JSON.stringify(parameter).replace(/\[|\]/g, '');
            const cold = JSON.stringify(cols);

            const res = await fetch(`${DIFY_HOST}/v1/workflows/run`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputs: {
                        task_id: id,                      //与工作流start里的输入变量名一致
                        col: cold,
                        parameters: params,
                    },
                    user: USER,
                    response_mode: 'blocking'
                })
            });
            if (!res.ok) throw new Error(`工作流运行失败: ${await res.text()}`);
            const {data} = await res.json(); // 直接返回结果
            console.log(data);
            const {outputs: fileOutputs} = data;
            prePDFOutputs = fileOutputs.pdf_url;
            console.log(prePDFOutputs);
        } catch (error) {
            console.error('工作流错误:', error);
            alert('工作流执行失败，请检查控制台');
            throw error; // 继续向上抛出
        }
    }

    //提交后端交互
    async function submitFlow(id, parameter, API_KEY, cols) {
        try {
            const USER = 'admin'; // 与你的工作流 user 一致
            const DIFY_HOST = ''; // 自建请换成对应域名

            //将数组转化为字符串并去除[]
            const params = JSON.stringify(parameter).replace(/\[|\]/g, '');
            const cold = JSON.stringify(cols);

            const res = await fetch(`${DIFY_HOST}/v1/workflows/run`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputs: {
                        task_id: id,                      //与工作流start里的输入变量名一致
                        col: cold,
                        parameters: params,
                    },
                    user: USER,
                    response_mode: 'blocking'
                })
            });
            if (!res.ok) throw new Error(`工作流运行失败: ${await res.text()}`);
            const {data} = await res.json(); // 直接返回结果
            console.log(data);
            const {outputs: fileOutputs} = data;
            //submitOutputs = fileOutputs.meta;
            if ('csv_url' in fileOutputs) {
                submitOutputs = fileOutputs.csv_url;
            } else {
                submitOutputs = fileOutputs.meta;
            }
            console.log(submitOutputs);
        } catch (error) {
            console.error('工作流错误:', error);
            alert('工作流执行失败，请检查控制台');
            throw error; // 继续向上抛出
        }
    }

}

//选择已有文件
// ===== 其他功能函数 =====
/**
 * 处理文件名变更事件
 * @param {Function} callback - 回调函数，接收文件名参数
 */
const unsubscribe = onFileNameChange((fileName) => {
    if (fileName) {
        selectFromSQL(fileName); // 你的处理函数
    }
});

/**
 * 从SQL选择文件并处理结果
 * @param {string} fileName - 文件名
 */
async function selectFromSQL(fileName) {
    const selectResult = await selectCsvFile(fileName);
    console.log(selectResult);
    handleDifyResult(selectResult);
}

//存入文件库
/**
 * 保存文件到文件库
 */
document.getElementById("saveBtn").addEventListener("click", async () => {
    //判断是否为缓存文件
    if (isTmp == true) {
        alert("该文件已存在文件库中，无法执行此操作");
        return;
    }

    await runSQLFlow(currentFile, taskId);
    isTmp = true;
})

/**
 * 运行SQL流程保存文件
 * @param {string} filename - 文件名
 * @param {string|number} id - 任务ID
 */
async function runSQLFlow(filename, id) {
    const API_KEY = ''; // 在 Dify「访问 API」里创建
    const USER = 'admin'; // 与你的工作流 user 一致
    const DIFY_HOST = ''; // 自建请换成对应域名
    try {
        const res = await fetch(`${DIFY_HOST}/v1/workflows/run`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: {
                    save_name: filename,                    //'input_file'与工作流start里的输入变量名一致
                    task_id: id
                },
                user: USER,
                response_mode: 'blocking'
            })
        });
        if (!res.ok) throw new Error(`工作流运行失败: ${await res.text()}`);
        const {data} = await res.json(); // 直接返回结果
        console.log(data);
    } catch (error) {
        console.error('工作流错误:', error);
        alert('工作流执行失败，请检查控制台');
        throw error; // 继续向上抛出
    }
}

// 模型数据
/*
mockData使用说明
api_url：dify提交操作密钥
preview_url：dify预览操作密钥
parameters：参数名字
state：模型的说明
*/
/**
 * 获取模型数据
 * @returns {Object} 模型数据对象
 */
function getMockData() {
    console.log(modelfileNames);
    console.log(selectedNames);
    const fileSet = new Set(modelfileNames);
    return {
        "线性代数": {
            'api_url': '',
            'preview_url': '',
            'parameters': {
                "meta1": {'value':3, 'state':'说明'},
                "meta2": {'value':'', 'state':''},
            },
            'state': `此处填对模型的说明`
        },
        "微积分": {
            'api_url': '',
            'preview_url': '',
            'parameters': {
                "meta1": {'value':3, 'state':'说明'},
                "meta2": {'value':'', 'state':''},
            },
            'state': ``
        },
        "机器学习": {
            'api_url': '',
            'preview_url': '',
            'parameters': {
                "meta1": {'value':3, 'state':'说明'},
                "meta2": {'value':'', 'state':''},
            },
            'state': ``
        },
        "深度学习": {
            'api_url': '',
            'preview_url': '',
            'parameters': {
                "meta1": {'value':3, 'state':'说明'},
                "meta2": {'value':'', 'state':''},
            },
            'state': ``
        },
        "线性回归": {
            'api_url': '',
            'preview_url': '',
            'parameters': {
                "meta1": {'value':3, 'state':'说明'},
                "meta2": {'value':'', 'state':''},
            },
            'state': ``
        },
        "决策树": {
            'api_url': '',
            'preview_url': '',
            'parameters': {
                "meta1": {'value':3, 'state':'说明'},
                "meta2": {'value':'', 'state':''},
            },
            'state': ``
        }
    };
}


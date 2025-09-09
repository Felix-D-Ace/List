/**
 * 文件选择模块 - 提供文件选择弹窗和相关功能
 * @module fileSelect
 */
// 全局变量
/**
 * 每页显示的文件数量
 * @constant {number}
 * @default
 */
const PAGE_SIZE = 10; // 每页显示10条

/**
 * 当前页码
 * @type {number}
 */
let currentPage = 1;

/**
 * 总页数
 * @type {number}
 */
let totalPages = 1;

/**
 * 从后端获取的所有文件数据
 * @type {Array<{name: string, size: string|number, modified: string}>}
 */
let allFiles = []; // 存储从后端获取的所有文件名

/**
 * 过滤后的文件列表
 * @type {Array<{name: string, size: string|number, modified: string}>}
 */
let filteredFiles = []; // 存储过滤后的文件列表

/**
 * 搜索关键词
 * @type {string}
 */
let searchTerm = '';

/**
 * 是否正在加载数据的标志
 * @type {boolean}
 */
let isLoading = false;

// Proxy 相关变量
/**
 * 实际存储的文件名
 * @type {string|null}
 * @private
 */
let _selectedFileName = null; // 实际存储文件名

/**
 * 文件名变更监听器集合
 * @type {Set<Function>}
 * @private
 */
const fileNameListeners = new Set(); // 存储监听回调

let modelfileNames;

// 导出 Proxy 对象
/**
 * 选中的文件名代理对象
 * 通过Proxy实现响应式数据变更通知
 * @type {Proxy}
 * @example
 * // 设置选中文件
 * selectedFileName.value = "example.csv";
 * // 获取选中文件
 * console.log(selectedFileName.value);
 */
export const selectedFileName = new Proxy({}, {
    /**
     * 设置属性值时的拦截器
     * @param {Object} target - 目标对象
     * @param {string} prop - 属性名
     * @param {*} value - 属性值
     * @returns {boolean}
     */
    set(target, prop, value) {
        if (prop === 'value') {
            _selectedFileName = value;
            fileNameListeners.forEach(fn => fn(value)); // 触发所有监听器
        }
        return true;
    },

    /**
     * 获取属性值时的拦截器
     * @param {Object} target - 目标对象
     * @param {string} prop - 属性名
     * @returns {*}
     */
    get(target, prop) {
        return prop === 'value' ? _selectedFileName : undefined;
    }
});

// 导出监听函数
/**
 * 注册文件名变更监听器
 * @param {Function} callback - 文件名变更时的回调函数
 * @returns {Function} 取消监听的函数
 * @example
 * const unsubscribe = onFileNameChange((fileName) => {
 *   console.log('文件名变为:', fileName);
 * });
 * // 取消监听
 * unsubscribe();
 */
export function onFileNameChange(callback) {
    fileNameListeners.add(callback);
    return () => fileNameListeners.delete(callback); // 返回取消监听函数
}

/**
 * 文件选择完成后的回调函数
 * @type {Function|null}
 * @private
 */
let fileSelectionCallback = null; // 用于接收选择结果的回调函数

document.getElementById("openModalBtn").addEventListener("click", createFileModal());
document.getElementById("openModalBtn").addEventListener("click", createFileModal());
// 创建弹窗
/**
 * 创建文件选择弹窗
 * @returns {void}
 */
function createFileModal() {
    // 1. 创建弹窗容器
    const modalContainer = document.createElement("div");
    modalContainer.className = "file-modal-container";
    modalContainer.id = "fileModal";

    // 2. 创建标题区域
    const header = document.createElement("div");
    header.className = "file-modal-header";

    const title = document.createElement("h3");
    title.className = "file-modal-title";
    title.textContent = "选择已有文件";
    header.appendChild(title);

    // 3. 创建关闭按钮
    const closeBtn = document.createElement("button");
    closeBtn.className = "file-modal-close-btn";
    closeBtn.textContent = "×";
    closeBtn.onclick = closeFileModal;
    header.appendChild(closeBtn);

    // 4. 创建内容容器
    const content = document.createElement("div");
    content.className = "file-modal-content";

    // 5. 创建主体内容
    const body = document.createElement("div");
    body.className = "file-modal-body";

    // 搜索区域
    const searchContainer = document.createElement("div");
    searchContainer.className = "file-search-container";

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "file-search-input";
    searchInput.placeholder = "搜索文件...";
    searchInput.id = "fileSearch";
    // 修改搜索输入事件
    searchInput.oninput = debounce(function() {
        searchTerm = this.value;
        currentPage = 1; // 搜索后重置到第一页
        applyFilterAndPagination(); // 应用新的过滤条件
    }, 300);

    const clearSearchBtn = document.createElement("button");
    clearSearchBtn.className = "file-clear-search-btn";
    clearSearchBtn.textContent = "清除";
    clearSearchBtn.onclick = function() {
        searchInput.value = "";
        searchTerm = "";
        currentPage = 1;
        loadFiles();
    };

    searchContainer.appendChild(searchInput);
    searchContainer.appendChild(clearSearchBtn);
    body.appendChild(searchContainer);

    // 文件表格容器
    const tableContainer = document.createElement("div");
    tableContainer.className = "file-table-container";

    const fileTable = document.createElement("table");
    fileTable.className = "file-table";
    fileTable.innerHTML = `
        <thead>
            <tr>
                <th>文件名</th>
                <th width="120">大小</th>
                <th width="180">修改时间</th>
            </tr>
        </thead>
        <tbody id="fileListBody"></tbody>
    `;

    tableContainer.appendChild(fileTable);
    body.appendChild(tableContainer);

    // 加载状态
    const loadingState = document.createElement("div");
    loadingState.className = "file-loading-state";
    loadingState.id = "loadingState";
    loadingState.textContent = "加载中...";
    loadingState.style.display = "none";
    body.appendChild(loadingState);

    // 空状态
    const emptyState = document.createElement("div");
    emptyState.className = "file-empty-state";
    emptyState.id = "emptyState";
    emptyState.textContent = "暂无文件";
    emptyState.style.display = "none";
    body.appendChild(emptyState);

    // 选中文件信息
    const selectedInfo = document.createElement("div");
    selectedInfo.className = "file-selected-info";
    selectedInfo.id = "selectedFileInfo";
    selectedInfo.style.display = "none";
    selectedInfo.innerHTML = '<p class="file-selected-text">已选择: <span id="selectedFileName"></span></p>';
    body.appendChild(selectedInfo);

    // 分页控件
    const pagination = document.createElement("div");
    pagination.className = "file-pagination-container";

    const prevBtn = document.createElement("button");
    prevBtn.className = "file-pagination-btn";
    prevBtn.id = "prevPageBtn";
    prevBtn.textContent = "上一页";
    prevBtn.onclick = function() { changePage(currentPage - 1); };

    const pageInfo = document.createElement("span");
    pageInfo.className = "file-page-info";
    pageInfo.id = "pageInfo";
    pageInfo.textContent = "第 1 页 / 共 1 页";

    const nextBtn = document.createElement("button");
    nextBtn.className = "file-pagination-btn";
    nextBtn.id = "nextPageBtn";
    nextBtn.textContent = "下一页";
    nextBtn.onclick = function() { changePage(currentPage + 1); };

    pagination.appendChild(prevBtn);
    pagination.appendChild(pageInfo);
    pagination.appendChild(nextBtn);
    body.appendChild(pagination);

    // 组装弹窗
    content.appendChild(header);
    content.appendChild(body);
    modalContainer.appendChild(content);

    // 添加到页面
    document.body.appendChild(modalContainer);

    // 绑定事件
    document.getElementById("openModalBtn").onclick = openFileModal;
}

// 打开弹窗
/**
 * 打开文件选择弹窗
 * 初始化弹窗状态并加载文件列表
 * @returns {void}
 */
function openFileModal() {
    selectedFileName.value = null; // 通过 Proxy 清空选择
    const modal = document.getElementById("fileModal");
    if (!modal) {
        console.error("弹窗未初始化，请先调用createFileModal()");
        return;
    }
    modal.classList.add("active");
    currentPage = 1;
    searchTerm = "";
    document.getElementById("fileSearch").value = "";
    document.getElementById("selectedFileInfo").style.display = "none";
    loadFiles();
}

// 关闭弹窗
/**
 * 关闭文件选择弹窗
 * 如果选择了文件且设置了回调函数，会触发回调
 * @returns {void}
 */
function closeFileModal() {
    const modal = document.getElementById("fileModal");
    modal.classList.remove("active");

    // 如果有回调函数且选择了文件，执行回调
    if (fileSelectionCallback && selectedFileName.value) {
        fileSelectionCallback(selectedFileName.value);
    }
}

// 加载文件列表
/*
async function loadFiles() {
    if (isLoading) return;
    isLoading = true;

    // 显示加载状态
    document.getElementById("loadingState").style.display = "block";
    document.getElementById("emptyState").style.display = "none";
    document.getElementById("fileListBody").innerHTML = "";

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

        const data = await response.json();

        // 假设后端返回的是文件名数组
        if (data.files && data.files.length > 0) {
            allFiles = data.files; // 保存所有文件名

            applyFilterAndPagination(); // 应用过滤和分页
        } else {
            document.getElementById("emptyState").style.display = "block";
        }
    } catch (error) {
        console.error("加载文件失败:", error);
        document.getElementById("fileListBody").innerHTML =
            '<tr><td colspan="3" style="text-align: center; color: red; padding: 20px;">加载失败，请重试</td></tr>';
    } finally {
        document.getElementById("loadingState").style.display = "none";
        isLoading = false;
    }
}
*/
/**
 * 从后端加载文件列表
 * 使用Dify工作流API获取文件元数据
 * @async
 * @returns {Promise<void>}
 */
async function loadFiles() {
    if (isLoading) return;
    isLoading = true;

    // 显示加载状态
    document.getElementById("loadingState").style.display = "block";
    document.getElementById("emptyState").style.display = "none";
    document.getElementById("fileListBody").innerHTML = "";

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
                allFiles = meta.name.map((name, index) => ({
                    name: name,
                    size: meta.size?.[index] || 'N/A',
                    modified: meta.modified?.[index] || 'N/A'
                }));

                console.log("转换后的文件列表:", allFiles); // 调试用
                //取出所有后端返回的文件名
                modelfileNames = allFiles.map(file => file.name);
                console.log(modelfileNames);
                applyFilterAndPagination();
            } catch (parseError) {
                console.error("解析files_meta失败:", parseError);
                document.getElementById("fileListBody").innerHTML =
                    '<tr><td colspan="3" style="color: red;">文件数据格式错误</td></tr>';
            }
        } else {
            console.warn("未找到 data.outputs.files_meta 字段");
            document.getElementById("emptyState").style.display = "block";
        }
    } catch (error) {
        console.error("请求失败:", error);
        document.getElementById("fileListBody").innerHTML =
            '<tr><td colspan="3" style="color: red;">加载失败，请检查网络</td></tr>';
    } finally {
        document.getElementById("loadingState").style.display = "none";
        isLoading = false;
    }
}

/**
 * 应用过滤和分页
 * 根据搜索关键词过滤文件并计算分页
 * @returns {void}
 */
function applyFilterAndPagination() {
    // 1. 应用搜索过滤
    filteredFiles = allFiles.filter(file =>
        file.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 2. 计算总分页数
    totalPages = Math.ceil(filteredFiles.length / PAGE_SIZE);

    // 3. 获取当前页数据
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, filteredFiles.length);
    const currentPageFiles = filteredFiles.slice(startIndex, endIndex);

    // 4. 渲染结果
    renderFileList(currentPageFiles);
    updatePagination();

    // 5. 显示空状态（如果没有匹配结果）
    if (filteredFiles.length === 0) {
        document.getElementById("emptyState").style.display = "block";
    }
}

// 渲染文件列表
/**
 * 渲染文件列表到表格
 * @param {Array<{name: string, size: string|number, modified: string}>} files - 要渲染的文件数组
 * @returns {void}
 */
function renderFileList(files) {
    const fileListBody = document.getElementById("fileListBody");
    fileListBody.innerHTML = "";

    files.forEach(file => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${escapeHtml(file.name)}</td>
            <td>${file.size ? formatFileSize(file.size) : 'N/A'}</td>
            <td>${file.modified ? formatDate(file.modified) : 'N/A'}</td>
        `;
        tr.onclick = () => {
            tr.classList.add('hover-highlight'); // CSS中添加对应样式
            setTimeout(() => tr.classList.remove('hover-highlight'), 500);
        };

        tr.ondblclick = () => selectFile(file);
        if (selectedFileName === file.name) {
            tr.classList.add("selected");
        }
        fileListBody.appendChild(tr);
    });
}

// 选择文件
/**
 * 选择文件处理函数
 * @param {{name: string, size: string|number, modified: string}} file - 选择的文件对象
 * @returns {void}
 */
function selectFile(file) {
    // 更新选中状态
    const rows = document.querySelectorAll(".file-table tr");
    rows.forEach(row => row.classList.remove("selected"));
    event.currentTarget.classList.add("selected");

    // 显示选中信息
    const selectedInfo = document.getElementById("selectedFileInfo");
    const selectedName = document.getElementById("selectedFileName");
    selectedInfo.style.display = "block";
    selectedName.textContent = file.name;

    // 保存选择结果
    selectedFileName.value = file.name;
    console.log("已选择文件:", selectedFileName.value);

    // 延迟关闭以确保UI更新完成
    setTimeout(closeFileModal, 100);
    document.getElementById("currentFile").innerText = selectedFileName.value;
}


// 分页切换
/**
 * 切换分页
 * @param {number} page - 目标页码
 * @returns {void}
 */
function changePage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    applyFilterAndPagination(); // 重新应用分页
}

/**
 * 更新分页控件状态
 * @returns {void}
 */
function updatePagination() {
    const pageInfo = document.getElementById("pageInfo");
    const prevBtn = document.getElementById("prevPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");

    pageInfo.textContent = `第 ${currentPage} 页 / 共 ${totalPages} 页`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
}

// 工具函数
/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * HTML转义函数
 * @param {string} unsafe - 未转义的HTML字符串
 * @returns {string} 转义后的安全字符串
 */
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * 格式化文件大小
 * 支持字节数或带单位的字符串
 * @param {string|number} size - 文件大小
 * @returns {string} 格式化后的文件大小字符串
 * @example
 * formatFileSize(1024); // returns "1 KB"
 * formatFileSize("2.5MB"); // returns "2.5 MB"
 */
function formatFileSize(size) {
    if (!size) return 'N/A';

    // 如果是纯数字（字节数）
    if (!isNaN(size)) {
        const bytes = Number(size);
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    // 如果是带单位字符串（如 "123kb"）
    if (typeof size === 'string') {
        // 提取数字和单位
        const match = size.match(/^([\d.]+)\s*([kmgtp]?b)?$/i);
        if (!match) return size; // 无法解析则原样返回

        const num = parseFloat(match[1]);
        const unit = (match[2] || '').toUpperCase();

        // 统一转换为KB/MB等标准单位
        const units = { 'KB': 1, 'MB': 2, 'GB': 3 };
        if (units[unit]) {
            return `${num} ${unit}`; // 已经是标准单位则直接返回
        }
        return `${num} B`; // 默认按字节处理
    }

    return 'N/A';
}

/**
 * 格式化日期字符串
 * @param {string} dateString - 日期字符串
 * @returns {string} 本地化格式的日期字符串
 */
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
}

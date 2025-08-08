// 使用 marked.js 的专业 Markdown 渲染器
// 安装依赖：npm install marked dompurify

class MarkdownRenderer {
    constructor() {
        // 检查是否在 Node.js 环境中（Electron main process）
        if (typeof require !== 'undefined') {
            try {
                this.marked = require('marked');
                this.DOMPurify = require('dompurify');
                
                // 配置 marked
                this.marked.setOptions({
                    breaks: true,        // 支持 GitHub 风格换行
                    gfm: true,          // 启用 GitHub 风格 markdown
                    headerIds: false,   // 不生成标题 ID
                    mangle: false,      // 不混淆邮箱地址
                });

                this.setupRenderer();
            } catch (error) {
                console.warn('marked.js 未安装，使用内置渲染器:', error.message);
                this.marked = null;
            }
        } else {
            console.warn('当前环境不支持 require，使用内置渲染器');
            this.marked = null;
        }
    }

    setupRenderer() {
        if (!this.marked) return;

        const renderer = new this.marked.Renderer();
        
        // 自定义代码块渲染
        renderer.code = (code, language, escaped) => {
            const lang = language || 'text';
            const randomId = Math.random().toString(36).substr(2, 9);
            
            return `<div class="code-block" data-language="${lang}">
                <div class="code-header">
                    <span class="code-language">${lang.toUpperCase()}</span>
                    <button class="copy-code-btn" onclick="chatManager.copyCode('${randomId}')" title="复制代码">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
                            <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
                        </svg>
                    </button>
                </div>
                <pre id="${randomId}"><code class="language-${lang}">${escaped ? code : this.escapeHtml(code)}</code></pre>
            </div>`;
        };

        // 自定义行内代码渲染
        renderer.codespan = (code) => {
            return `<code class="message-code">${code}</code>`;
        };

        // 自定义标题渲染
        renderer.heading = (text, level) => {
            const className = `message-h${level}`;
            return `<h${level} class="${className}">${text}</h${level}>`;
        };

        // 自定义列表渲染
        renderer.list = (body, ordered, start) => {
            const type = ordered ? 'ol' : 'ul';
            const className = ordered ? 'message-ol' : 'message-ul';
            const startAttr = (ordered && start !== 1) ? ` start="${start}"` : '';
            return `<${type} class="${className}"${startAttr}>${body}</${type}>`;
        };

        renderer.listitem = (text) => {
            return `<li class="message-li">${text}</li>`;
        };

        // 自定义水平线渲染
        renderer.hr = () => {
            return '<hr class="message-hr">';
        };

        // 自定义引用块渲染
        renderer.blockquote = (quote) => {
            return `<blockquote class="message-quote">${quote}</blockquote>`;
        };

        // 自定义段落渲染
        renderer.paragraph = (text) => {
            return `<p class="message-paragraph">${text}</p>`;
        };

        // 自定义链接渲染
        renderer.link = (href, title, text) => {
            const titleAttr = title ? ` title="${title}"` : '';
            return `<a href="${href}" class="message-link" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
        };

        // 自定义图片渲染
        renderer.image = (href, title, text) => {
            const titleAttr = title ? ` title="${title}"` : '';
            return `<img src="${href}" alt="${text}" class="message-image" onclick="chatManager.openImage('${href}')"${titleAttr} />`;
        };

        // 自定义粗体渲染
        renderer.strong = (text) => {
            return `<strong class="message-bold">${text}</strong>`;
        };

        // 自定义斜体渲染
        renderer.em = (text) => {
            return `<em class="message-italic">${text}</em>`;
        };

        // 自定义删除线渲染
        renderer.del = (text) => {
            return `<del class="message-strikethrough">${text}</del>`;
        };

        // 应用自定义渲染器
        this.marked.use({ renderer });
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 主要渲染方法
    renderMarkdown(content) {
        if (!content) return '';

        // 如果有 marked.js，使用专业渲染器
        if (this.marked) {
            try {
                let html = this.marked.parse(content);
                
                // 如果有 DOMPurify，进行安全清理
                if (this.DOMPurify) {
                    html = this.DOMPurify.sanitize(html, {
                        ALLOWED_TAGS: [
                            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                            'p', 'br', 'hr',
                            'strong', 'b', 'em', 'i', 'u', 'del', 'mark',
                            'ul', 'ol', 'li',
                            'blockquote',
                            'code', 'pre', 'div', 'span',
                            'a', 'img',
                            'table', 'thead', 'tbody', 'tr', 'th', 'td',
                            'button', 'svg', 'path'
                        ],
                        ALLOWED_ATTR: [
                            'class', 'id', 'href', 'src', 'alt', 'title',
                            'data-language', 'data-number',
                            'onclick', 'target', 'rel',
                            'width', 'height', 'viewBox', 'fill',
                            'start'
                        ],
                        KEEP_CONTENT: true
                    });
                }
                
                return html;
            } catch (error) {
                console.error('Markdown 渲染失败:', error);
                return this.fallbackRender(content);
            }
        }

        // 降级到内置渲染器
        return this.fallbackRender(content);
    }

    // 降级渲染方法（使用现有的 renderRichText）
    fallbackRender(content) {
        // 如果 ChatManager 实例存在，使用其 renderRichText 方法
        if (window.chatManager && typeof window.chatManager.renderRichText === 'function') {
            return window.chatManager.renderRichText(content);
        }
        
        // 最简单的降级处理
        return this.escapeHtml(content).replace(/\n/g, '<br>');
    }

    // 处理用户消息中的随机ID（复制原有逻辑）
    formatMessageContent(content, messageType = 'assistant') {
        if (messageType === 'user') {
            const uniqueIdRegex = /\[请忽略该行内容，唯一随机任务id：([^\]]+)\]/g;
            const match = uniqueIdRegex.exec(content);
            
            if (match) {
                const uniqueId = match[1];
                const contentWithoutId = content.replace(uniqueIdRegex, '');
                const randomId = Math.random().toString(36).substr(2, 9);
                
                const hiddenIdElement = `
                    <div class="unique-id-container" data-random-id="${randomId}">
                        <div class="unique-id-toggle" onclick="chatManager.toggleUniqueId('${randomId}')">
                            <span class="toggle-text">显示随机任务ID</span>
                            <svg class="toggle-icon" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                                <path d="M4 6l4 4V2z"/>
                            </svg>
                        </div>
                        <div class="unique-id-content" style="display: none;">
                            <code>[请忽略该行内容，唯一随机任务id：${uniqueId}]</code>
                        </div>
                    </div>
                `;
                
                return this.renderMarkdown(contentWithoutId) + hiddenIdElement;
            }
        }
        
        return this.renderMarkdown(content);
    }
}

// 创建全局实例
window.markdownRenderer = new MarkdownRenderer();

// 导出类（用于 Node.js 环境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarkdownRenderer;
}
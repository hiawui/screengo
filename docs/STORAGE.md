# 存储方案说明

## 跨域名共享配置

如果需要在多个不同域名的网页之间共享配置（如语言偏好），有以下几种方案：

### 1. chrome.storage（推荐用于跨域名共享）

**优点：**
- ✅ 可以在所有域名的content script之间共享
- ✅ 扩展级别的存储，不依赖页面
- ✅ 数据持久化，即使扩展重启也保留

**缺点：**
- ❌ 需要 `storage` 权限
- ❌ 异步API，使用稍复杂

**使用场景：**
- 需要在不同域名的网页之间共享配置
- 需要扩展级别的全局设置

### 2. localStorage（仅当前域名）

**优点：**
- ✅ 不需要额外权限
- ✅ 同步API，使用简单
- ✅ 浏览器原生支持

**缺点：**
- ❌ 每个域名独立，无法跨域名共享
- ❌ 受同源策略限制

**使用场景：**
- 仅需要在当前域名内保存配置
- 不需要跨域名共享

### 3. 混合方案（当前实现）

当前代码实现了混合方案：
1. **优先使用 chrome.storage**：如果可用（有storage权限），使用它实现跨域名共享
2. **降级到 localStorage**：如果chrome.storage不可用，使用localStorage作为备选

**优点：**
- ✅ 灵活：有权限时跨域名共享，无权限时至少在当前域名可用
- ✅ 向后兼容：即使移除storage权限也能工作

## 当前实现

代码会自动检测并使用最佳方案：

```typescript
// 优先尝试chrome.storage（跨域名共享）
if (chrome.storage && chrome.storage.local) {
  await chrome.storage.local.get(['preferredLanguage']);
} 
// 降级到localStorage（仅当前域名）
else if (typeof Storage !== 'undefined') {
  localStorage.getItem('screengo_preferredLanguage');
}
```

## 建议

- **如果需要跨域名共享**：添加 `storage` 权限，使用 `chrome.storage`
- **如果不需要跨域名共享**：使用 `localStorage`，不需要额外权限
- **如果需要灵活性**：使用当前的混合方案


# Scripts 目录

此目录包含项目的所有shell脚本。

## 脚本列表

### package.sh

Chrome扩展打包脚本。

**用法：**
```bash
# 构建并创建zip文件
./scripts/package.sh

# 仅构建，不创建zip
./scripts/package.sh --no-zip
./scripts/package.sh -n
```

**功能：**
- 自动构建项目（调用 `npm run build`）
- 创建zip打包文件
- 保留dist目录用于开发测试

**通过npm运行：**
```bash
npm run package        # 构建并创建zip
npm run package:no-zip # 仅构建
```


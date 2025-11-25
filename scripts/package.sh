#!/bin/bash

# Chrome扩展打包脚本

# 设置颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 解析命令行参数
CREATE_ZIP=true
if [ "$1" == "--no-zip" ] || [ "$1" == "-n" ]; then
    CREATE_ZIP=false
    echo -e "${GREEN}开始编译Chrome扩展（不创建zip）...${NC}"
else
    echo -e "${GREEN}开始打包Chrome扩展...${NC}"
fi

# 检查并同步版本号
echo "检查版本号一致性..."
# 使用 node 读取版本号，确保准确性
PKG_VERSION=$(node -p "require('./package.json').version")
MANIFEST_VERSION=$(node -p "require('./manifest.json').version")

if [ "$PKG_VERSION" != "$MANIFEST_VERSION" ]; then
    echo -e "${YELLOW}版本不一致: package.json ($PKG_VERSION) != manifest.json ($MANIFEST_VERSION)${NC}"
    echo "更新 manifest.json 版本号为 $PKG_VERSION..."
    
    # 使用 node 更新 manifest.json，保持格式
    node -e "
        const fs = require('fs');
        const manifest = require('./manifest.json');
        manifest.version = '$PKG_VERSION';
        fs.writeFileSync('./manifest.json', JSON.stringify(manifest, null, 2) + '\n');
    "
    VERSION=$PKG_VERSION
else
    echo -e "${GREEN}版本一致: $PKG_VERSION${NC}"
    VERSION=$PKG_VERSION
fi

echo -e "当前版本: ${YELLOW}${VERSION}${NC}"

# 创建打包目录
PACKAGE_NAME="screengo-${VERSION}"
ZIP_FILE="${PACKAGE_NAME}.zip"

# 清理旧文件（仅在创建zip时）
if [ "$CREATE_ZIP" = true ]; then
    if [ -f "$ZIP_FILE" ]; then
        echo "删除旧的打包文件: $ZIP_FILE"
        rm "$ZIP_FILE"
    fi
fi

# 构建项目
echo "构建项目..."
npm run build

# 使用dist目录作为打包目录
TEMP_DIR="dist"
echo "打包目录: $TEMP_DIR"

# 创建zip文件（如果启用）
if [ "$CREATE_ZIP" = true ]; then
    echo "创建zip文件: $ZIP_FILE"
    cd "$TEMP_DIR"
    zip -r "$OLDPWD/$ZIP_FILE" . > /dev/null
    cd "$OLDPWD"
    
    # 检查zip文件大小
    if [ -f "$ZIP_FILE" ]; then
        ZIP_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
        echo -e "Zip文件大小: ${YELLOW}${ZIP_SIZE}${NC}"
    fi
fi

# 保留打包目录（不删除）
echo "打包目录保留在: $TEMP_DIR"

echo -e "${GREEN}编译完成!${NC}"
if [ "$CREATE_ZIP" = true ]; then
    if [ -f "$ZIP_FILE" ]; then
        FILE_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
        echo -e "Zip文件: ${YELLOW}${ZIP_FILE}${NC}"
        echo -e "大小: ${YELLOW}${FILE_SIZE}${NC}"
        echo ""
        echo "上传到Chrome Web Store:"
        echo "访问 https://chrome.google.com/webstore/devconsole"
        echo "上传 $ZIP_FILE 文件"
        echo ""
    fi
fi
echo "安装说明:"
echo "1. 打开Chrome浏览器，访问 chrome://extensions/"
echo "2. 启用'开发者模式'"
echo "3. 点击'加载已解压的扩展程序'"
echo "4. 选择 $TEMP_DIR 文件夹"
echo ""
echo "使用 --no-zip 或 -n 参数可以只编译不创建zip文件"


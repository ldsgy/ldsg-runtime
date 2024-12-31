# 设定构建阶段基础镜像
FROM node:lts

# 设定工作目录
WORKDIR /app

# 拷贝应用
COPY ./ /app

# 准备
RUN npm i -g pnpm

# 安装依赖
RUN pnpm i

# 构建
RUN pnpm build

# 清理
RUN rm -rf node_modules src

# 安装生产依赖
RUN pnpm i --only=prod

# 设定入口点
ENTRYPOINT ["npm", "start"]
# v0.1 Acceptance Checklist

## Project

- [ ] 可以创建项目
- [ ] 可以切换项目
- [ ] 项目之间 Artifact 列表隔离
- [ ] 项目之间 Run 历史隔离
- [ ] 默认项目自动创建
- [ ] 刷新页面记住当前项目

## Skill

- [ ] 可以查看 Skill 列表
- [ ] 可以查看 Skill 详情（完整 instruction）
- [ ] 可以 Reload Skill（修改 SKILL.md 后无需重启）
- [ ] Skill 缺少章节时显示 warning
- [ ] Prompt Debugger 可以预览组装后的 Prompt

## File Context

- [ ] 可以上传 txt/md/json 文件
- [ ] 可以删除文件
- [ ] 可以勾选文件作为上下文
- [ ] Run 时文件内容被注入 Prompt
- [ ] Refine 时文件内容被注入 Prompt
- [ ] 超过 2MB 的文件被拒绝
- [ ] 不允许的扩展名被拒绝

## Artifact 生成

- [ ] 可以生成 Markdown Artifact
- [ ] 可以生成 HTML Artifact
- [ ] SSE 流式输出正常
- [ ] 生成过程中显示实时内容
- [ ] 生成失败显示错误信息

## Artifact 操作

- [ ] 可以预览 Markdown（渲染后）
- [ ] 可以预览 HTML（sandbox iframe）
- [ ] 可以 Refine（AI 修改）
- [ ] Refine 后版本链更新
- [ ] 可以 Edit（手动编辑）
- [ ] Edit 后保存为新版本
- [ ] 版本链可以点击切换
- [ ] 可以 Copy 内容到剪贴板
- [ ] 可以 Download 为对应格式文件
- [ ] 下载文件名安全（无非法字符）

## Template

- [ ] 可以查看模板列表
- [ ] 可以查看模板详情（含变量）
- [ ] 可以填写变量表单
- [ ] "直接创建" 生成 Artifact
- [ ] "交给 Agent 优化" 触发 Agent Run
- [ ] 变量替换正确（未填写的保留原样）

## Export

- [ ] `GET /api/artifacts/:id/export` 返回正确 Content-Type
- [ ] Content-Disposition 文件名正确
- [ ] 下载内容与预览内容一致

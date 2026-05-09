---
id: security-incident-report
name: 安全事件通报模板
description: 标准 MSS 安全事件通报格式，适用于告警转正式通报场景
type: markdown
skillId: mss-alert-report
variables:
  - name: customerName
    label: 客户名称
    type: text
    required: true
  - name: incidentTitle
    label: 事件标题
    type: text
    required: true
  - name: riskLevel
    label: 风险等级
    type: select
    required: true
    options:
      - 低危
      - 中危
      - 高危
      - 严重
  - name: incidentTime
    label: 事件时间
    type: text
    required: true
  - name: sourceIp
    label: 源 IP 地址
    type: text
  - name: targetSystem
    label: 目标系统
    type: text
  - name: detail
    label: 事件详情
    type: textarea
---

# 【MSS】安全事件通报

**致：** {{customerName}}
**通报编号：** MSS-{{incidentTime}}
**通报日期：** {{incidentTime}}

---

## 一、事件概述

**事件标题：** {{incidentTitle}}
**风险等级：** {{riskLevel}}
**发现时间：** {{incidentTime}}

## 二、影响范围

**源 IP：** {{sourceIp}}
**目标系统：** {{targetSystem}}

## 三、事件详情

{{detail}}

## 四、威胁分析

（待补充：威胁情报关联、攻击手法分析）

## 五、处置建议

1. 立即确认受影响系统范围
2. 对相关 IP 进行封禁或监控
3. 检查目标系统是否存在异常进程
4. 更新相关安全规则

## 六、后续跟踪

- 持续监控相关指标
- 72 小时内提交处置反馈
- 必要时启动应急响应流程

---

*本通报由 MSS 安全托管服务自动生成，如有疑问请联系安全运营团队。*

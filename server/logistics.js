/**
 * 模拟物流：按「支付时间 + 固定偏移」动态推算当前节点（未付款订单不推进）。
 * 无定时任务、刷新不重置、换设备也保持。被点餐端 shop.js 与后台 router.js 共用。
 */
const nowSec = () => Math.floor(Date.now() / 1000)
const p2 = n => String(n).padStart(2, '0')
const fmtStamp = (sec) => {
  const d = new Date(Number(sec) * 1000)
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) +
    ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds())
}

// 节点：offset 为「下单后多少秒」进入该节点；short 供后台列表简洁展示
const LOGI_STEPS = [
  { text: '订单已提交，等待商家接单', short: '已下单', offset: 0 },
  { text: '商家已接单，正在备餐', short: '商家接单', offset: 20 },
  { text: '餐品制作中，请耐心等待', short: '制作中', offset: 50 },
  { text: '骑手已取餐，正在配送', short: '骑手取餐', offset: 90, send: true },
  { text: '配送中，即将送达', short: '配送中', offset: 120 },
  { text: '订单已送达，感谢惠顾', short: '已送达', offset: 180 }
]

// 发货节点：物流推进到「骑手已取餐」即视为「已发货」
const SEND_STEP = LOGI_STEPS.find(s => s.send)

// paid: 是否已付款；payTime: 支付时间戳（NULL 表示未付款）。
// 未付款订单物流不推进（仅「已提交」完成、其余待推进、不自动发货），传 undefined 视为已付款（向后兼容）。
// 已付款订单物流从「支付时间」起算（缺失回退下单时间），避免下单后很久才付款导致物流瞬间跳到最后。
function computeLogistics (createTime, paid, payTime) {
  const unpaid = paid === false
  const base = unpaid
    ? (Number(createTime) || nowSec())
    : (Number(payTime) || Number(createTime) || nowSec())
  const elapsed = unpaid ? 0 : Math.max(0, nowSec() - base)
  const last = LOGI_STEPS.length - 1
  const finished = !unpaid && elapsed >= LOGI_STEPS[last].offset
  const autoSend = !unpaid && (SEND_STEP ? elapsed >= SEND_STEP.offset : false)
  const steps = LOGI_STEPS.map((s, i) => ({
    context: s.text,
    short: s.short,
    time: fmtStamp(base + s.offset),
    status: elapsed >= s.offset ? 'done' : 'pending'
  }))
  const cur = steps.findIndex(s => s.status === 'pending')
  if (cur !== -1 && !unpaid) steps[cur].status = 'current'
  // 未付款时无「进行中」节点，current 固定指向「已提交」，供列表展示当前状态
  return { steps, current: unpaid ? 0 : (cur === -1 ? last : cur), finished, autoSend }
}

module.exports = { LOGI_STEPS, computeLogistics }

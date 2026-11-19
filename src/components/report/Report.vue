<template>
    <div>
        <!-- 面包屑导航区 -->
        <el-breadcrumb separator-class="el-icon-arrow-right">
            <el-breadcrumb-item :to="{ path: '/home' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>数据统计</el-breadcrumb-item>
            <el-breadcrumb-item>数据报表</el-breadcrumb-item>
        </el-breadcrumb>

        <!-- 顶部统计卡片 -->
        <el-row :gutter="20" class="stat-cards">
            <el-col :span="6" v-for="card in statCards" :key="card.label">
                <el-card class="stat-card" shadow="hover">
                    <div class="stat-icon" :style="{ background: card.bg, color: card.color }">
                        <i :class="card.icon"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value" :style="{ color: card.color }">{{ card.value }}</div>
                        <div class="stat-label">{{ card.label }}</div>
                    </div>
                </el-card>
            </el-col>
        </el-row>

        <!-- 图表区域 -->
        <el-row :gutter="20">
            <el-col :span="16">
                <el-card shadow="hover">
                    <div class="chart-header">
                        <span class="chart-title">近 7 天订单趋势</span>
                    </div>
                    <div id="trendChart" class="chart"></div>
                </el-card>
            </el-col>
            <el-col :span="8">
                <el-card shadow="hover">
                    <div class="chart-header">
                        <span class="chart-title">用户角色分布</span>
                    </div>
                    <div id="roleChart" class="chart"></div>
                </el-card>
            </el-col>
        </el-row>

        <!-- 订单状态区域 -->
        <el-row :gutter="20" class="status-cards">
            <el-col :span="12">
                <el-card shadow="hover">
                    <div class="chart-header">
                        <span class="chart-title">订单支付状态</span>
                    </div>
                    <div class="status-row">
                        <div class="status-item">
                            <div class="status-num paid">{{ paidOrders }}</div>
                            <div class="status-label">已付款</div>
                        </div>
                        <el-progress :percentage="payPercent" :stroke-width="10" :color="payColor"></el-progress>
                        <div class="status-item">
                            <div class="status-num unpaid">{{ unpaidOrders }}</div>
                            <div class="status-label">未付款</div>
                        </div>
                    </div>
                </el-card>
            </el-col>
            <el-col :span="12">
                <el-card shadow="hover">
                    <div class="chart-header">
                        <span class="chart-title">订单发货状态</span>
                    </div>
                    <div class="status-row">
                        <div class="status-item">
                            <div class="status-num sent">{{ sentOrders }}</div>
                            <div class="status-label">已发货</div>
                        </div>
                        <el-progress :percentage="sendPercent" :stroke-width="10" :color="sendColor"></el-progress>
                        <div class="status-item">
                            <div class="status-num unsent">{{ unsentOrders }}</div>
                            <div class="status-label">未发货</div>
                        </div>
                    </div>
                </el-card>
            </el-col>
        </el-row>
    </div>
</template>

<script>
import * as echarts from 'echarts'

export default {
  data () {
    return {
      totalUsers: 0,
      totalOrders: 0,
      totalFoods: 0,
      totalAmount: 0,
      paidOrders: 0,
      unpaidOrders: 0,
      sentOrders: 0,
      unsentOrders: 0,
      trendChart: null,
      roleChart: null
    }
  },
  computed: {
    statCards () {
      return [
        { label: '总用户数', value: this.totalUsers, icon: 'el-icon-user-solid', bg: '#e8f1ff', color: '#2563eb' },
        { label: '总订单数', value: this.totalOrders, icon: 'el-icon-s-order', bg: '#e6fbf4', color: '#10b981' },
        { label: '总菜品数', value: this.totalFoods, icon: 'el-icon-s-shop', bg: '#fff4e6', color: '#f59e0b' },
        { label: '订单总额', value: '¥' + this.totalAmount, icon: 'el-icon-s-marketing', bg: '#f3e8ff', color: '#8b5cf6' }
      ]
    },
    payPercent () {
      const total = this.paidOrders + this.unpaidOrders
      return total === 0 ? 0 : Math.round((this.paidOrders / total) * 100)
    },
    sendPercent () {
      const total = this.sentOrders + this.unsentOrders
      return total === 0 ? 0 : Math.round((this.sentOrders / total) * 100)
    },
    payColor () {
      return this.payPercent >= 60 ? '#10b981' : (this.payPercent >= 30 ? '#f59e0b' : '#ef4444')
    },
    sendColor () {
      return this.sendPercent >= 60 ? '#10b981' : (this.sendPercent >= 30 ? '#f59e0b' : '#ef4444')
    }
  },
  mounted () {
    this.trendChart = echarts.init(document.getElementById('trendChart'))
    this.roleChart = echarts.init(document.getElementById('roleChart'))
    this.fetchStatistics()
    window.addEventListener('resize', this.handleResize)
  },
  beforeDestroy () {
    window.removeEventListener('resize', this.handleResize)
    if (this.trendChart) {
      this.trendChart.dispose()
      this.trendChart = null
    }
    if (this.roleChart) {
      this.roleChart.dispose()
      this.roleChart = null
    }
  },
  methods: {
    // 加载统计数据
    fetchStatistics () {
      this.$api.statistics().then((res) => {
        if (res.data.status === 200) {
          const d = res.data.data
          this.totalUsers = d.totalUsers || 0
          this.totalOrders = d.totalOrders || 0
          this.totalFoods = d.totalFoods || 0
          this.totalAmount = d.totalAmount || 0
          this.paidOrders = d.paidOrders || 0
          this.unpaidOrders = d.unpaidOrders || 0
          this.sentOrders = d.sentOrders || 0
          this.unsentOrders = d.unsentOrders || 0
          this.renderTrend(d.orderTrend || [])
          this.renderRole(d.roleDist || [])
        }
      })
    },
    // 近 7 天订单趋势
    renderTrend (trend) {
      const dates = trend.map(t => t.date)
      const counts = trend.map(t => t.count)
      const amounts = trend.map(t => t.amount)
      this.trendChart.setOption({
        tooltip: { trigger: 'axis' },
        legend: { data: ['订单数', '订单金额'] },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: [{ type: 'category', data: dates, boundaryGap: false }],
        yAxis: [
          { type: 'value', name: '订单数', minInterval: 1 },
          { type: 'value', name: '金额(元)' }
        ],
        series: [
          {
            name: '订单数',
            type: 'bar',
            barWidth: '40%',
            itemStyle: { color: '#2563eb' },
            data: counts
          },
          {
            name: '订单金额',
            type: 'line',
            yAxisIndex: 1,
            smooth: true,
            itemStyle: { color: '#f59e0b' },
            lineStyle: { width: 3 },
            data: amounts
          }
        ]
      })
    },
    // 用户角色分布饼图
    renderRole (roleDist) {
      this.roleChart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { bottom: 0 },
        color: ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'],
        series: [
          {
            type: 'pie',
            radius: ['40%', '68%'],
            center: ['50%', '45%'],
            label: { formatter: '{b}\n{c}' },
            data: roleDist.map(r => ({ name: r.name, value: Number(r.value) }))
          }
        ]
      })
    },
    handleResize () {
      if (this.trendChart) this.trendChart.resize()
      if (this.roleChart) this.roleChart.resize()
    }
  }
}
</script>

<style scoped>
    .stat-cards {
        margin-bottom: 20px;
    }

    .stat-card {
        border-radius: 10px;
    }

    .stat-card :deep(.el-card__body) {
        display: flex;
        align-items: center;
        padding: 20px;
    }

    .stat-icon {
        width: 54px;
        height: 54px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 26px;
        flex-shrink: 0;
    }

    .stat-info {
        margin-left: 16px;
    }

    .stat-value {
        font-size: 26px;
        font-weight: 700;
        line-height: 1.2;
    }

    .stat-label {
        font-size: 13px;
        color: #909399;
        margin-top: 4px;
    }

    .chart-header {
        margin-bottom: 10px;
    }

    .chart-title {
        font-size: 15px;
        font-weight: 600;
        color: #303133;
    }

    .chart {
        width: 100%;
        height: 320px;
    }

    .status-cards {
        margin-top: 20px;
    }

    .status-row {
        display: flex;
        align-items: center;
        gap: 20px;
        padding: 10px 0;
    }

    .status-item {
        text-align: center;
        flex-shrink: 0;
    }

    .status-num {
        font-size: 24px;
        font-weight: 700;
        line-height: 1.2;
    }

    .status-num.paid {
        color: #10b981;
    }

    .status-num.unpaid {
        color: #ef4444;
    }

    .status-num.sent {
        color: #2563eb;
    }

    .status-num.unsent {
        color: #f59e0b;
    }

    .status-label {
        font-size: 12px;
        color: #909399;
        margin-top: 4px;
    }

    .status-row :deep(.el-progress) {
        flex: 1;
    }
</style>

<template>
    <div>
        <!-- 面包屑导航区 -->
        <el-breadcrumb separator-class="el-icon-arrow-right">
            <el-breadcrumb-item :to="{ path: '/home' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>订单管理</el-breadcrumb-item>
            <el-breadcrumb-item>订单列表</el-breadcrumb-item>
        </el-breadcrumb>
        <!-- 卡片视图区 -->
        <el-card>
            <el-row :gutter="20">
                <el-col :span="8">
                    <el-input placeholder="请输入订单编号" v-model="queryInfo.query" clearable @clear="getOrderList">
                        <el-button slot="append" icon="el-icon-search" @click="onSubmitSearch"></el-button>
                    </el-input>
                </el-col>
            </el-row>

            <!-- 订单列表数据-->
            <el-table :data="orderList" border stripe>
                <el-table-column type="index"></el-table-column>
                <el-table-column label="订单编号" prop="order_number"></el-table-column>
                <el-table-column label="订单价格" prop="order_price"></el-table-column>
                <el-table-column label="是否付款" prop="pay_status">
                    <template slot-scope="scope">
                        <el-tag type="success" v-if="scope.row.pay_status === 1">已付款</el-tag>
                        <el-tag type="danger" v-else>未付款</el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="是否发货" prop="is_send">
                    <template slot-scope="scope">
                        <el-tag type="success" v-if="scope.row.is_send === 1">已发货</el-tag>
                        <el-tag type="info" v-else>未发货</el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="收货地址" prop="address" min-width="200px">
                    <template slot-scope="scope">
                        {{ scope.row.address || '未填写' }}
                    </template>
                </el-table-column>
                <el-table-column label="下单时间" prop="create_time">
                    <template slot-scope="scope">
                        {{scope.row.create_time | dateFormat}}
                    </template>
                </el-table-column>
                <el-table-column label="操作" width="230px">
                    <template v-slot="scope">
                        <el-button type="primary" icon="el-icon-edit" size="mini" v-if="isAdmin" @click="showBox(scope.row)" title="修改地址"></el-button>
                        <el-button type="warning" icon="el-icon-goods" size="mini" @click="showItems(scope.row)" title="商品明细"></el-button>
                        <el-button type="info" icon="el-icon-s-tools" size="mini" v-if="isAdmin" @click="showStatus(scope.row)" title="修改状态"></el-button>
                        <el-button type="success" icon="el-icon-location" size="mini" @click="showProgressBox(scope.row)" title="物流进度"></el-button>
                    </template>
                </el-table-column>
            </el-table>
            <!-- 分页区 -->
            <el-pagination
                    @size-change="handleSizeChange"
                    @current-change="handleCurrentChange"
                    :current-page="queryInfo.pagenum"
                    :page-sizes="[5, 10, 15]"
                    :page-size="queryInfo.pagesize"
                    layout="total, sizes, prev, pager, next, jumper"
                    :total="total">
            </el-pagination>
        </el-card>
        <!-- 修改地址对话框-->
        <el-dialog
                title="修改地址"
                :visible.sync="addressVisible"
                width="50%"
                @close="addressDialogClosed"
        >
            <el-form :model="addressForm" :rules="addressFormRules" ref="addressFormRef" label-width="100px">
                <el-form-item label="省市区/县" prop="address1">
                    <el-cascader :options="cityData" v-model="addressForm.address1"></el-cascader>
                </el-form-item>
                <el-form-item label="详细地址" prop="address2">
                    <el-input v-model="addressForm.address2"></el-input>
                </el-form-item>
            </el-form>
            <span slot="footer" class="dialog-footer">
                <el-button @click="addressVisible = false">取 消</el-button>
                <el-button type="primary" @click="saveAddress">确 定</el-button>
            </span>
        </el-dialog>

        <!-- 订单商品明细对话框-->
        <el-dialog title="订单商品明细" :visible.sync="itemsVisible" width="50%">
            <el-table :data="itemsList" border stripe>
                <el-table-column type="index"></el-table-column>
                <el-table-column label="商品名称" prop="foods_name"></el-table-column>
                <el-table-column label="单价(元)" prop="foods_price"></el-table-column>
                <el-table-column label="数量" prop="count"></el-table-column>
                <el-table-column label="小计(元)">
                    <template slot-scope="scope">
                        {{ (Number(scope.row.foods_price) * scope.row.count).toFixed(2) }}
                    </template>
                </el-table-column>
            </el-table>
            <div v-if="!itemsList.length" style="text-align:center;color:#999;padding:20px;">该订单暂无商品明细</div>
        </el-dialog>

        <!-- 修改订单状态对话框-->
        <el-dialog title="修改订单状态" :visible.sync="statusVisible" width="40%">
            <el-form label-width="80px">
                <el-form-item label="支付状态">
                    <el-switch v-model="statusForm.pay_status" :active-value="1" :inactive-value="0"
                               active-text="已付款" inactive-text="未付款"></el-switch>
                </el-form-item>
                <el-form-item label="发货状态">
                    <el-switch v-model="statusForm.is_send" :active-value="1" :inactive-value="0"
                               active-text="已发货" inactive-text="未发货"></el-switch>
                </el-form-item>
            </el-form>
            <span slot="footer" class="dialog-footer">
                <el-button @click="statusVisible = false">取 消</el-button>
                <el-button type="primary" @click="saveStatus">保 存</el-button>
            </span>
        </el-dialog>

        <!-- 物流进度对话框-->
        <el-dialog
                title="物流进度"
                :visible.sync="progressVisible"
                width="50%"
        >
            <!-- 时间线 -->
            <el-timeline>
                <el-timeline-item
                        v-for="(activity, index) in this.progressInfo"
                        :key="index"
                        :timestamp="activity.time">
                    {{activity.context}}
                </el-timeline-item>
            </el-timeline>
            <div v-if="!progressInfo.length" style="text-align:center;color:#999;padding:10px;">暂无物流信息</div>
            <div v-if="isAdmin" style="margin-top:15px;">
                <el-input v-model="logisticsText" placeholder="输入物流节点，如：商家已接单" style="width:70%"></el-input>
                <el-button type="primary" style="margin-left:10px;" @click="addLogistics">添加节点</el-button>
            </div>
        </el-dialog>
    </div>
</template>

<script>
/* 导入城市数据 */
import cityData from './citydata'

export default {
  name: 'Order',
  data () {
    return {
      queryInfo: {
        query: '',
        pagenum: 1,
        pagesize: 10
      },
      total: 0,
      orderList: [],
      addressVisible: false,
      addressForm: {
        address1: [],
        address2: ''
      },
      addressFormRules: {
        address1: [
          { required: true, message: '请选择省市区县', trigger: 'blur' }
        ],
        address2: [
          { required: true, message: '请填写详细地址', trigger: 'blur' }
        ]
      },
      cityData: cityData,
      progressVisible: false,
      progressInfo: [],
      logisticsText: '',
      itemsVisible: false,
      itemsList: [],
      statusVisible: false,
      statusForm: { pay_status: 0, is_send: 0 },
      currentOrder: {}
    }
  },
  computed: {
    isAdmin () {
      return this.$store.getters['login/isAdmin']
    }
  },
  created () {
    this.getOrderList()
  },
  methods: {
    async getOrderList () {
      this.$api.order({
        pagenum: this.queryInfo.pagenum,
        pagesize: this.queryInfo.pagesize
      }).then((res) => {
        if (res.data.status === 200) {
          this.orderList = res.data.result || []
          this.total = res.data.total || 0
        }
      })
    },
    handleSizeChange (newSize) {
      this.queryInfo.pagesize = newSize
      this.getDataList()
    },
    handleCurrentChange (newPage) {
      this.queryInfo.pagenum = newPage
      this.getDataList()
    },
    // 统一数据加载：有搜索词走搜索，否则走列表（翻页时保留搜索条件）
    getDataList () {
      if (this.queryInfo.query) {
        this.$api.ordersearch({
          search: this.queryInfo.query,
          pagenum: this.queryInfo.pagenum,
          pagesize: this.queryInfo.pagesize
        }).then((res) => {
          if (res.data.status === 200) {
            this.orderList = res.data.result || []
            this.total = res.data.total || 0
          }
        })
      } else {
        this.getOrderList()
      }
    },
    // 展示修改地址对话框
    showBox (row) {
      this.currentOrder = row
      // 回显已有地址（格式：省/市/区 详细地址）
      const addr = row.address || ''
      if (addr) {
        const idx = addr.indexOf(' ')
        if (idx !== -1) {
          this.addressForm.address1 = addr.slice(0, idx).split('/')
          this.addressForm.address2 = addr.slice(idx + 1)
        } else {
          this.addressForm.address1 = []
          this.addressForm.address2 = addr
        }
      } else {
        this.addressForm.address1 = []
        this.addressForm.address2 = ''
      }
      this.addressVisible = true
    },
    // 保存地址（前端校验 + 调后端接口）
    saveAddress () {
      this.$refs.addressFormRef.validate(valid => {
        if (!valid) {
          return this.$message.error('请完整填写地址信息')
        }
        const address = this.addressForm.address1.join('/') + ' ' + this.addressForm.address2
        this.$api.updateOrderAddress({
          order_id: this.currentOrder.order_id,
          address: address
        }).then((res) => {
          if (res.data.status === 200) {
            this.$message.success('地址已保存')
            this.addressVisible = false
            this.getOrderList()
          } else {
            this.$message.error(res.data.msg || '地址保存失败')
          }
        })
      })
    },
    addressDialogClosed () {
      this.$refs.addressFormRef.resetFields()
    },
    // 展示订单商品明细
    showItems (row) {
      this.$api.orderitems({ order_id: row.order_id }).then((res) => {
        if (res.data.status === 200) {
          this.itemsList = res.data.result || []
          this.itemsVisible = true
        }
      })
    },
    // 展示修改状态对话框
    showStatus (row) {
      this.currentOrder = row
      this.statusForm = { pay_status: row.pay_status, is_send: row.is_send }
      this.statusVisible = true
    },
    // 保存订单状态
    saveStatus () {
      this.$api.updateOrderStatus({
        order_id: this.currentOrder.order_id,
        pay_status: this.statusForm.pay_status,
        is_send: this.statusForm.is_send
      }).then((res) => {
        if (res.data.status === 200) {
          this.$message.success('订单状态已更新')
          this.statusVisible = false
          this.getOrderList()
        } else {
          this.$message.error(res.data.msg || '状态更新失败')
        }
      })
    },
    // 物流进度展示
    showProgressBox (row) {
      this.currentOrder = row
      try {
        this.progressInfo = JSON.parse(row.logistics || '[]')
      } catch (e) {
        this.progressInfo = []
      }
      this.logisticsText = ''
      this.progressVisible = true
    },
    // 追加物流节点
    addLogistics () {
      if (!this.logisticsText.trim()) {
        return this.$message.error('请输入物流内容')
      }
      const context = this.logisticsText.trim()
      this.$api.addLogistics({
        order_id: this.currentOrder.order_id,
        context: context
      }).then((res) => {
        if (res.data.status === 200) {
          this.$message.success('物流信息已更新')
          this.logisticsText = ''
          // 本地追加时间线节点，并同步订单列表
          this.progressInfo.push({ time: this.nowStr(), context: context })
          this.getOrderList()
        } else {
          this.$message.error(res.data.msg || '物流更新失败')
        }
      })
    },
    nowStr () {
      const now = new Date()
      const pad = n => String(n).padStart(2, '0')
      return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
        ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds())
    },
    // 订单查询
    onSubmitSearch () {
      this.queryInfo.pagenum = 1
      this.getDataList()
    }
  }
}
</script>

<style lang="less" scoped>
    .el-cascader {
        width: 100%;
    }
</style>

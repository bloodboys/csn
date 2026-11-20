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
                <el-table-column label="下单顾客" width="120px">
                    <template slot-scope="scope">
                        <span v-if="scope.row.customer_name">{{ scope.row.customer_name }}</span>
                        <span v-else style="color:#bbb;">后台代下单</span>
                    </template>
                </el-table-column>
                <el-table-column label="是否付款" prop="pay_status">
                    <template slot-scope="scope">
                        <el-tag type="info" v-if="scope.row.order_status === 1">已取消</el-tag>
                        <el-tag type="success" v-else-if="scope.row.pay_status === 1">已付款</el-tag>
                        <el-tag type="danger" v-else>未付款</el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="是否发货" prop="is_send">
                    <template slot-scope="scope">
                        <el-tag type="info" v-if="scope.row.order_status === 1">—</el-tag>
                        <el-tag type="success" v-else-if="scope.row.is_send === 1">已发货</el-tag>
                        <el-tag type="info" v-else>未发货</el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="物流节点" width="120px">
                    <template slot-scope="scope">
                        <el-tag size="small" :type="scope.row.logi_finished ? 'success' : 'warning'">
                            {{ scope.row.logi_status || '—' }}
                        </el-tag>
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
                <el-table-column label="操作" width="280px">
                    <template v-slot="scope">
                        <el-button type="primary" icon="el-icon-edit" size="mini" v-if="isAdmin" @click="showBox(scope.row)" title="修改地址"></el-button>
                        <el-button type="warning" icon="el-icon-goods" size="mini" @click="showItems(scope.row)" title="商品明细"></el-button>
                        <el-button type="info" icon="el-icon-s-tools" size="mini" v-if="isAdmin" @click="showStatus(scope.row)" title="修改状态"></el-button>
                        <el-button type="success" icon="el-icon-location" size="mini" @click="showProgressBox(scope.row)" title="物流进度"></el-button>
                        <el-button class="op-cancel" type="danger" plain icon="el-icon-circle-close" size="mini" v-if="isAdmin && scope.row.order_status !== 1 && scope.row.is_send !== 1" @click="cancelOrder(scope.row)" title="取消订单"></el-button>
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
                <el-table-column label="规格" width="140px">
                    <template slot-scope="scope">
                        <span v-if="scope.row.attr_text" style="color:#ff6b35">{{ scope.row.attr_text }}</span>
                        <span v-else style="color:#c0c4cc">—</span>
                    </template>
                </el-table-column>
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
            <!-- 时间线（自动推算节点，三态） -->
            <el-timeline>
                <el-timeline-item
                        v-for="(activity, index) in this.progressInfo"
                        :key="index"
                        :timestamp="activity.time"
                        :color="activity.status === 'done' ? '#67C23A' : (activity.status === 'current' ? '#E6A23C' : '#C0C4CC')">
                    <span :class="{ 'logi-current': activity.status === 'current' }">{{activity.context}}</span>
                    <el-tag v-if="activity.status === 'current'" size="mini" type="warning" style="margin-left:8px;">进行中</el-tag>
                    <el-tag v-else-if="activity.status === 'done'" size="mini" type="success" style="margin-left:8px;">已完成</el-tag>
                </el-timeline-item>
            </el-timeline>
            <div v-if="!progressInfo.length" style="text-align:center;color:#999;padding:10px;">暂无物流信息</div>
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
    // 取消订单（回补库存，仅未发货可取消）
    cancelOrder (row) {
      this.$confirm('确定取消订单 ' + row.order_number + ' 吗？取消后将回补库存。', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '再想想',
        type: 'warning'
      }).then(() => {
        this.$api.cancelOrder({ order_id: row.order_id }).then((res) => {
          if (res.data.status === 200) {
            this.$message.success('订单已取消，库存已回补')
            this.getOrderList()
          } else {
            this.$message.error(res.data.msg || '取消失败')
          }
        })
      }).catch(() => {})
    },
    // 物流进度展示
    showProgressBox (row) {
      this.currentOrder = row
      // 优先用后端自动推算的完整节点（三态）
      if (Array.isArray(row.logi_steps) && row.logi_steps.length) {
        this.progressInfo = row.logi_steps
      } else {
        // 回退：老订单无 logi_steps 时，解析静态 logistics 并统一视为已完成
        try {
          const raw = JSON.parse(row.logistics || '[]')
          this.progressInfo = raw.map(x => ({ context: x.context, time: x.time, status: 'done' }))
        } catch (e) {
          this.progressInfo = []
        }
      }
      this.progressVisible = true
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
    .logi-current {
        font-weight: 600;
        color: #E6A23C;
    }
    // 取消订单按钮：与前面编辑/查看类按钮用竖线分隔，避免误点
    .el-button.op-cancel {
        margin-left: 20px;
        position: relative;
    }
    .el-button.op-cancel::before {
        content: '';
        position: absolute;
        left: -11px;
        top: 50%;
        transform: translateY(-50%);
        width: 1px;
        height: 14px;
        background: #dcdfe6;
    }
    .el-button.op-cancel:hover {
        background: #fef0f0;
        border-color: #f56c6c;
        color: #f56c6c;
    }
</style>

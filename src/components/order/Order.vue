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
                <el-table-column label="操作">
                    <template v-slot="scope">
                        <el-button type="primary" icon="el-icon-edit" size="mini" v-if="isAdmin" @click="showBox(scope.row)"></el-button>
                        <el-button type="success" icon="el-icon-location" size="mini"
                                   @click="showProgressBox(scope.row.logistics)"></el-button>
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
    // 物流进度展示
    showProgressBox (info) {
      try {
        this.progressInfo = JSON.parse(info || '[]')
      } catch (e) {
        this.progressInfo = []
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
</style>

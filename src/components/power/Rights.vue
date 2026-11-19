<template>
    <div>
        <!-- 面包屑区域 -->
        <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/home' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>权限管理</el-breadcrumb-item>
            <el-breadcrumb-item>权限列表</el-breadcrumb-item>
        </el-breadcrumb>

        <!-- 卡片视图区域 -->
        <el-card>
            <el-row>
                <el-col>
                    <el-button type="primary" v-if="isAdmin" icon="el-icon-plus" @click="openAddDialog(null)">添加一级权限</el-button>
                </el-col>
            </el-row>

            <!-- 权限树形表格 -->
            <el-table :data="rightsTree" border row-key="id" :tree-props="{ children: 'children' }"
                default-expand-all>
                <el-table-column label="权限名称" prop="authName"></el-table-column>
                <el-table-column label="权限路径" prop="path"></el-table-column>
                <el-table-column label="权限 ID" prop="id" width="100"></el-table-column>
                <el-table-column label="操作" width="240" v-if="isAdmin">
                    <template slot-scope="scope">
                        <el-button type="success" size="mini" icon="el-icon-plus" v-if="scope.row.children"
                            @click="openAddDialog(scope.row)">添加子权限</el-button>
                        <el-button type="primary" size="mini" icon="el-icon-edit"
                            @click="openEditDialog(scope.row)">编辑</el-button>
                        <el-button type="danger" size="mini" icon="el-icon-delete"
                            @click="removeRight(scope.row)">删除</el-button>
                    </template>
                </el-table-column>
            </el-table>
        </el-card>

        <!-- 添加/编辑权限对话框 -->
        <el-dialog :title="dialogTitle" :visible.sync="dialogVisible" width="40%" @close="dialogClosed">
            <el-form :model="form" :rules="formRules" ref="formRef" label-width="90px">
                <el-form-item label="权限名称" prop="authName">
                    <el-input v-model="form.authName" placeholder="请输入权限名称"></el-input>
                </el-form-item>
                <el-form-item label="权限路径" prop="path">
                    <el-input v-model="form.path" placeholder="请输入权限路径，如 users"></el-input>
                </el-form-item>
                <el-form-item label="父级权限" v-if="!isEdit && form.pid !== 0">
                    <el-input :value="parentName" disabled></el-input>
                </el-form-item>
            </el-form>
            <span slot="footer" class="dialog-footer">
                <el-button @click="dialogVisible = false">取 消</el-button>
                <el-button type="primary" @click="submit">确 定</el-button>
            </span>
        </el-dialog>
    </div>
</template>

<script>
export default {
  data () {
    return {
      // 权限树
      rightsTree: [],
      // 对话框控制
      dialogVisible: false,
      // 是否为编辑模式
      isEdit: false,
      // 表单数据（id 编辑时用，pid 添加二级时用）
      form: {
        id: null,
        authName: '',
        path: '',
        pid: 0
      },
      // 添加二级权限时展示的父级名称
      parentName: '',
      // 表单校验规则
      formRules: {
        authName: [
          { required: true, message: '请输入权限名称', trigger: 'blur' }
        ],
        path: [
          { required: true, message: '请输入权限路径', trigger: 'blur' }
        ]
      }
    }
  },
  computed: {
    isAdmin () {
      return this.$store.getters['login/isAdmin']
    },
    dialogTitle () {
      if (this.isEdit) return '编辑权限'
      return this.form.pid === 0 ? '添加一级权限' : '添加子权限'
    }
  },
  created () {
    this.getRightsTree()
  },
  methods: {
    // 获取权限树
    getRightsTree () {
      this.$api.rightstree().then((res) => {
        if (res.data.status === 200) {
          this.rightsTree = res.data.result || []
        }
      })
    },
    // 打开添加对话框（parent 为 null 表示一级，否则为二级）
    openAddDialog (parent) {
      this.isEdit = false
      this.form = { id: null, authName: '', path: '', pid: parent ? parent.id : 0 }
      this.parentName = parent ? parent.authName : ''
      this.dialogVisible = true
    },
    // 打开编辑对话框
    openEditDialog (row) {
      this.isEdit = true
      this.form = { id: row.id, authName: row.authName, path: row.path, pid: 0 }
      this.parentName = ''
      this.dialogVisible = true
    },
    // 提交添加/编辑
    submit () {
      this.$refs.formRef.validate(valid => {
        if (!valid) return
        if (this.isEdit) {
          this.$api.updateright({
            id: this.form.id,
            authName: this.form.authName,
            path: this.form.path
          }).then((res) => {
            if (res.data.status === 200) {
              this.$message.success('编辑权限成功!')
              this.dialogVisible = false
              this.getRightsTree()
            } else {
              this.$message.error(res.data.msg || '编辑权限失败!')
            }
          })
        } else {
          this.$api.addright({
            authName: this.form.authName,
            path: this.form.path,
            pid: this.form.pid
          }).then((res) => {
            if (res.data.status === 200) {
              this.$message.success('添加权限成功!')
              this.dialogVisible = false
              this.getRightsTree()
            } else {
              this.$message.error(res.data.msg || '添加权限失败!')
            }
          })
        }
      })
    },
    // 删除权限
    removeRight (row) {
      this.$confirm('此操作将永久删除该权限, 是否继续?', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.$api.deleteright({ id: row.id }).then((res) => {
          if (res.data.status === 200) {
            this.$message.success('权限删除成功!')
            this.getRightsTree()
          } else {
            this.$message.error(res.data.msg || '权限删除失败!')
          }
        })
      }).catch(() => {
        this.$message.info('已取消删除')
      })
    },
    // 对话框关闭时重置
    dialogClosed () {
      this.$refs.formRef.resetFields()
      this.form = { id: null, authName: '', path: '', pid: 0 }
      this.parentName = ''
    }
  }
}
</script>

<style lang="less" scoped>
</style>

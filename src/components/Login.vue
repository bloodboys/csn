<template>
    <div class="login_container">
        <div class="deco deco1"></div>
        <div class="deco deco2"></div>
        <div class="login_box">
            <div class="login_header">
                <div class="avatar_box">
                    <img src="../assets/csn.png" alt="">
                </div>
                <h2 class="login_title">吃啥呢外卖平台</h2>
                <p class="login_subtitle">后台管理系统</p>
            </div>
            <el-form ref="loginFormRef" :model="loginForm" :rules="loginFormRules" label-width="0px" class="login_form">
                <!-- 用户名 -->
                <el-form-item prop="username">
                    <el-input v-model="loginForm.username" prefix-icon="el-icon-user" placeholder="请输入用户名"></el-input>
                </el-form-item>
                <!-- 密码 -->
                <el-form-item prop="password">
                    <el-input v-model="loginForm.password" prefix-icon="el-icon-lock" type="password" placeholder="请输入密码"></el-input>
                </el-form-item>
                <!-- 按钮区域 -->
                <el-form-item class="btns">
                    <el-button type="primary" class="login_btn" @click="login">登 录</el-button>
                    <el-button class="reset_btn" @click="resetLoginForm">重 置</el-button>
                </el-form-item>
            </el-form>
        </div>
    </div>
</template>

<script>
import api from '../api'
import {
  mapMutations
} from 'vuex'

export default {
  data () {
    return {
      // 数据表单的数据绑定对象
      loginForm: {
        username: '',
        password: ''
      },

      // 表单验证规则对象
      loginFormRules: {
        // 验证用户名是否合法
        username: [{
          required: true,
          message: '请输入用户名',
          trigger: 'blur'
        },
        {
          min: 3,
          max: 10,
          message: '长度在 3 到 10 个字符',
          trigger: 'blur'
        }
        ],
        // 验证密码是否合法
        password: [{
          required: true,
          message: '请输入密码',
          trigger: 'blur'
        },
        {
          min: 6,
          max: 15,
          message: '长度在 6 到 15 个字符',
          trigger: 'blur'
        }
        ]

      }
    }
  },
  methods: {
    // 点击重置按钮，重置登录表单
    resetLoginForm () {
      this.$refs.loginFormRef.resetFields()
    },
    ...mapMutations('login', ['setUser']),
    login () {
      this.$refs.loginFormRef.validate(valid => {
        if (!valid) {

        } else {
          // 登陆接口
          api.login(this.loginForm).then((res) => {
            if (res.data.status === 200) {
              this.setUser(res.data)
              localStorage.setItem(
                'csn',
                JSON.stringify(res.data)
              )
              // console.log(this.setUser(res.data.token))
              this.$message.success('登录成功')
              this.$router.push('/home')
            } else {
              this.$message.error('登录失败')
            }
          })
        }
      })
    }
  }
}
</script>

<style lang="less" scoped>
    .login_container {
        height: 100%;
        background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 55%, #06b6d4 100%);
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .deco {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.06);
    }

    .deco1 {
        width: 420px;
        height: 420px;
        top: -130px;
        left: -110px;
    }

    .deco2 {
        width: 300px;
        height: 300px;
        bottom: -90px;
        right: -70px;
    }

    .login_box {
        width: 420px;
        background: #fff;
        border-radius: 14px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
        padding: 40px 36px 30px;
        box-sizing: border-box;
        animation: fadeUp 0.5s ease;
    }

    @keyframes fadeUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .login_header {
        text-align: center;
        margin-bottom: 28px;
    }

    .avatar_box {
        width: 76px;
        height: 76px;
        margin: 0 auto 14px;
        border-radius: 50%;
        padding: 5px;
        background: #f0f5ff;
        box-shadow: 0 6px 16px rgba(59, 130, 246, 0.2);

        img {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: #e6f1fb;
        }
    }

    .login_title {
        margin: 0;
        font-size: 22px;
        font-weight: 600;
        color: #1f2d3d;
    }

    .login_subtitle {
        margin: 6px 0 0;
        font-size: 13px;
        color: #909399;
        letter-spacing: 3px;
    }

    .login_form {
        .el-input__inner {
            border-radius: 8px;
            height: 44px;
            border-color: #e4e7ed;
        }

        .el-input__inner:focus {
            border-color: #3b82f6;
        }
    }

    .btns {
        display: flex;
        flex-direction: column;
        margin-top: 6px;

        .el-button {
            width: 100%;
            height: 44px;
            border-radius: 8px;
            font-size: 15px;
            margin-left: 0;
        }

        .login_btn {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border: none;
        }

        .login_btn:hover {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
        }

        .reset_btn {
            margin-top: 10px;
        }
    }
</style>

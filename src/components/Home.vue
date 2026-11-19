<template>
    <el-container class="home-container">
        <!-- 头部区域 -->
        <el-header>
            <div id="">
                <img src="../assets/csn.png" />
                <span>吃啥呢外卖平台管理系统</span>
            </div>
            <el-button type="info" @click='logout'>退出</el-button>
        </el-header>
        <!-- 页面主体区域 -->
        <el-container>
            <!-- 侧边栏 -->
            <el-aside :width="isCollapse?'64px':'200px'">
                <div class="toggle-button" @click="toggleCollapse">
                    |||
                </div>
                <!-- 侧边栏菜单区 -->
                <el-menu background-color="#333744" text-color="#fff" active-text-color="#409eff" unique-opened
                    :collapse="isCollapse" :collapse-transition="false" router :default-active="activePath">
                    <!-- 一级菜单 -->
                    <el-submenu :index="item.id+''" v-for="item in menulist" :key="item.id">
                        <!-- 一级菜单的模板 -->
                        <template slot="title">
                            <!-- 图标 -->
                            <i :class="iconsObj[item.id]"></i>
                            <!-- 文本 -->
                            <span>{{item.authName}}</span>
                        </template>
                        <!-- 二级菜单 -->
                        <el-menu-item :index="'/'+subItem.path" v-for="subItem in item.children"
                            :key="subItem.id" @click="saveNavState('/'+subItem.path)">
                            <template slot="title">
                                <!-- 图标 -->
                                <i class="el-icon-menu"></i>
                                <!-- 文本 -->
                                <span>{{subItem.authName}}</span>
                            </template>
                        </el-menu-item>
                    </el-submenu>

                </el-menu>
            </el-aside>
            <!-- 右侧主体 -->
            <el-main>
                <router-view></router-view>
            </el-main>
        </el-container>
    </el-container>
</template>

<script>
export default {
  created () {
    this.getMenuList()
    this.activePath = localStorage.getItem('activePath')
  },
  data () {
    return {
      // 左侧菜单数据
      menulist: [],
      iconsObj: {
        101: 'el-icon-user-solid',
        102: 'el-icon-s-check',
        103: 'el-icon-s-shop',
        104: 'el-icon-s-order',
        105: 'el-icon-s-marketing'
      },
      // 是否折叠
      isCollapse: false,
      // 被激活的链接地址
      activePath: ''
    }
  },
  methods: {
    logout () {
      localStorage.removeItem('csn')
      this.$store.commit('login/setUser', { username: '', token: '' })
      this.$router.push('/login')
    },
    // 获取所有的菜单
    getMenuList () {
      this.$api.menus().then((res) => {
        if (res.data.status === 200) {
          this.menulist = (res.data.result || []).map(item => {
            let children = []
            try {
              children = JSON.parse(item.children || '[]')
            } catch (e) {
              children = []
            }
            return { ...item, children }
          })
        }
      })
    },
    // 点击切换按钮，切换展开或折叠左侧菜单
    toggleCollapse () {
      this.isCollapse = !this.isCollapse
    },
    // 被激活的链接地址
    saveNavState (activePath) {
      localStorage.setItem('activePath', activePath)
      this.activePath = activePath
    }
  }
}
</script>

<style lang="less" scoped>
    .home-container {
        height: 100%;
    }

    .el-header {
        background: linear-gradient(90deg, #1e3a8a, #3b82f6);
        display: flex;
        justify-content: space-between;
        padding-left: 20px;
        align-items: center;
        color: #fff;
        font-size: 19px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

        >div {
            display: flex;
            align-items: center;

            img {
                width: 34px;
                height: 34px;
                border-radius: 50%;
                margin-right: 10px;
                background: #fff;
            }

            span {
                font-weight: 600;
                letter-spacing: 1px;
            }
        }
    }

    .el-aside {
        background-color: #1f2d3d;

        .el-menu {
            border-right: none;
            background-color: transparent;
        }

        .el-submenu__title {
            color: #c0c4cc;
        }

        .el-submenu__title:hover {
            background-color: #2b3a4a;
        }

        .el-menu-item {
            color: #c0c4cc;
            background-color: transparent;
        }

        .el-menu-item:hover,
        .el-menu-item.is-active {
            color: #fff;
            background-color: #3b82f6;
        }
    }

    .el-main {
        background-color: #f0f2f5;
    }

    .el-icon-user-solid::before,
    .el-icon-s-check::before,
    .el-icon-s-shop::before,
    .el-icon-s-order::before,
    .el-icon-s-marketing::before {
        margin-right: 10px;
    }

    .toggle-button {
        background-color: #2b3a4a;
        font-size: 12px;
        line-height: 28px;
        color: #c0c4cc;
        text-align: center;
        letter-spacing: 0.2em;
        cursor: pointer;
        transition: background-color 0.2s, color 0.2s;
    }

    .toggle-button:hover {
        background-color: #3b82f6;
        color: #fff;
    }
</style>

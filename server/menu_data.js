/**
 * 菜单数据单一数据源
 * 被 server/migrate.js（启动时补缺）与 server/seed_menu.js（手动重置）共同引用，
 * 避免两处维护导致数据漂移。
 */

// 分类树：写入 foodscate.id=1 的 children 字段，前后台共用
const tree = [
  {
    cat_id: 1,
    cat_name: '中式正餐',
    cat_pid: 0,
    cat_level: 0,
    cat_deleted: false,
    children: [
      {
        cat_id: 1,
        cat_name: '热菜',
        cat_pid: 1,
        cat_level: 1,
        cat_ppid: [1],
        cat_deleted: false,
        children: [
          { cat_id: 1, cat_name: '川菜', cat_pid: 1, cat_level: 2, cat_ppid: [1, 1], cat_deleted: false },
          { cat_id: 2, cat_name: '家常小炒', cat_pid: 1, cat_level: 2, cat_ppid: [1, 1], cat_deleted: false }
        ]
      },
      {
        cat_id: 2,
        cat_name: '主食',
        cat_pid: 1,
        cat_level: 1,
        cat_ppid: [1],
        cat_deleted: false,
        children: [
          { cat_id: 1, cat_name: '炒饭盖饭', cat_pid: 2, cat_level: 2, cat_ppid: [1, 2], cat_deleted: false },
          { cat_id: 2, cat_name: '面食汤粉', cat_pid: 2, cat_level: 2, cat_ppid: [1, 2], cat_deleted: false }
        ]
      }
    ]
  },
  {
    cat_id: 2,
    cat_name: '饮品',
    cat_pid: 0,
    cat_level: 0,
    cat_deleted: false,
    children: [
      {
        cat_id: 1,
        cat_name: '奶茶',
        cat_pid: 2,
        cat_level: 1,
        cat_ppid: [2],
        cat_deleted: false,
        children: [
          { cat_id: 1, cat_name: '经典奶茶', cat_pid: 1, cat_level: 2, cat_ppid: [2, 1], cat_deleted: false },
          { cat_id: 2, cat_name: '鲜果茶', cat_pid: 1, cat_level: 2, cat_ppid: [2, 1], cat_deleted: false }
        ]
      },
      {
        cat_id: 2,
        cat_name: '鲜榨果汁',
        cat_pid: 2,
        cat_level: 1,
        cat_ppid: [2],
        cat_deleted: false
      }
    ]
  },
  {
    cat_id: 3,
    cat_name: '小吃',
    cat_pid: 0,
    cat_level: 0,
    cat_deleted: false,
    children: [
      {
        cat_id: 1,
        cat_name: '凉菜卤味',
        cat_pid: 3,
        cat_level: 1,
        cat_ppid: [3],
        cat_deleted: false
      },
      {
        cat_id: 2,
        cat_name: '炸物点心',
        cat_pid: 3,
        cat_level: 1,
        cat_ppid: [3],
        cat_deleted: false
      }
    ]
  }
]

// 菜品：有 id 表示修正既有记录，无 id 表示按菜名查重后插入
const dishes = [
  // ===== 川菜 1,1,1 =====
  { id: 6, name: '麻婆豆腐', cat: '1,1,1', price: '18', num: 80, weight: '400g', hot: 0,
    desc: '嫩豆腐切块配牛肉末，郫县豆瓣与汉源花椒炒出红油，麻辣鲜香、嫩滑下饭。' },
  { id: 7, name: '宫保鸡丁', cat: '1,1,1', price: '22', num: 60, weight: '450g', hot: 0,
    desc: '鸡腿肉丁配油酥花生米、干辣椒与葱段，糊辣荔枝味，酸甜微辣。' },
  { id: 8, name: '水煮鱼', cat: '1,1,1', price: '48', num: 40, weight: '750g', hot: 0,
    desc: '草鱼片现片现煮，垫豆芽与青笋，滚油泼豆瓣与干辣椒，麻辣鲜嫩。' },
  { name: '回锅肉', cat: '1,1,1', price: '32', num: 50, weight: '400g', hot: 1,
    desc: '二刀肉煮后回锅，配蒜苗与郫县豆瓣炒至起灯盏窝，肥而不腻。' },
  { name: '鱼香肉丝', cat: '1,1,1', price: '26', num: 55, weight: '350g', hot: 0,
    desc: '里脊肉丝配木耳、青笋丝，泡椒调出鱼香汁，酸甜微辣带葱香。' },
  { name: '辣子鸡', cat: '1,1,1', price: '38', num: 40, weight: '500g', hot: 0,
    desc: '鸡腿肉炸至外酥里嫩，与大量干辣椒、花椒同炒，越嚼越香。' },
  { name: '毛血旺', cat: '1,1,1', price: '42', num: 35, weight: '600g', hot: 0,
    desc: '鸭血、毛肚、黄喉、午餐肉同煮，红油汤底麻辣厚重。' },
  { name: '干煸四季豆', cat: '1,1,1', price: '22', num: 60, weight: '300g', hot: 0,
    desc: '四季豆煸至虎皮起皱，配肉末与芽菜，干香微辣。' },
  { name: '水煮牛肉', cat: '1,1,1', price: '46', num: 35, weight: '650g', hot: 0,
    desc: '牛里脊片上浆滑煮，垫豆芽，泼热油激香辣椒面，麻辣嫩滑。' },

  // ===== 家常小炒 1,1,2 =====
  { id: 1, name: '红烧肉', cat: '1,1,2', price: '34', num: 60, weight: '450g', hot: 0,
    desc: '五花肉切块冰糖炒糖色，慢炖至软糯，浓油赤酱、咸甜适口。' },
  { name: '番茄炒蛋', cat: '1,1,2', price: '16', num: 90, weight: '350g', hot: 0,
    desc: '沙瓤番茄配土鸡蛋，大火快炒出汁，酸甜下饭。' },
  { name: '青椒肉丝', cat: '1,1,2', price: '24', num: 65, weight: '350g', hot: 0,
    desc: '里脊肉丝滑炒，配螺丝椒与蒜片，清脆微辣。' },
  { name: '糖醋里脊', cat: '1,1,2', price: '30', num: 50, weight: '400g', hot: 1,
    desc: '里脊条裹脆浆炸至金黄，浇番茄糖醋汁，外脆里嫩、酸甜开胃。' },
  { name: '手撕包菜', cat: '1,1,2', price: '16', num: 80, weight: '300g', hot: 0,
    desc: '手撕包菜配干辣椒、蒜片大火爆炒，爽脆带锅气。' },
  { name: '蒜蓉西兰花', cat: '1,1,2', price: '20', num: 70, weight: '300g', hot: 0,
    desc: '西兰花焯水后与蒜蓉清炒，清淡爽口少油。' },
  { name: '酸辣土豆丝', cat: '1,1,2', price: '14', num: 90, weight: '300g', hot: 0,
    desc: '土豆手切细丝，白醋与干辣椒炝炒，脆爽酸辣。' },
  { name: '农家小炒肉', cat: '1,1,2', price: '28', num: 55, weight: '400g', hot: 0,
    desc: '五花肉片与螺丝椒同炒，咸香微辣，湖南家常做法。' },
  { name: '可乐鸡翅', cat: '1,1,2', price: '26', num: 50, weight: '400g', hot: 0,
    desc: '鸡中翅煎至两面金黄，可乐收汁，甜咸入味，共 6 只。' },

  // ===== 炒饭盖饭 1,2,1 =====
  { id: 9, name: '蛋炒饭', cat: '1,2,1', price: '12', num: 100, weight: '500g', hot: 0,
    desc: '隔夜米粒粒分明，配鸡蛋、葱花与火腿丁，大火快炒。' },
  { name: '扬州炒饭', cat: '1,2,1', price: '18', num: 70, weight: '450g', hot: 0,
    desc: '虾仁、火腿、青豆、玉米与蛋花同炒，配料丰富。' },
  { name: '牛肉盖饭', cat: '1,2,1', price: '28', num: 60, weight: '550g', hot: 1,
    desc: '黑椒牛柳配洋葱大火快炒，盖在热米饭上，酱汁浓稠。' },
  { name: '宫保鸡丁盖饭', cat: '1,2,1', price: '24', num: 60, weight: '550g', hot: 0,
    desc: '招牌宫保鸡丁现炒浇饭，糊辣荔枝味，配米饭一份。' },
  { name: '番茄鸡蛋盖饭', cat: '1,2,1', price: '18', num: 70, weight: '500g', hot: 0,
    desc: '番茄炒蛋浇在热米饭上，汤汁拌饭，家常味道。' },
  { name: '咖喱鸡肉饭', cat: '1,2,1', price: '26', num: 55, weight: '550g', hot: 0,
    desc: '鸡腿肉与土豆、胡萝卜炖煮，日式咖喱微辣，配米饭。' },

  // ===== 面食汤粉 1,2,2 =====
  { name: '红烧牛肉面', cat: '1,2,2', price: '26', num: 50, weight: '600g', hot: 1,
    desc: '牛腩慢炖三小时，配手擀面与青菜，汤浓肉烂。' },
  { name: '番茄鸡蛋面', cat: '1,2,2', price: '18', num: 60, weight: '550g', hot: 0,
    desc: '番茄熬汤打蛋花，配细面，酸鲜开胃。' },
  { name: '酸辣粉', cat: '1,2,2', price: '16', num: 70, weight: '450g', hot: 0,
    desc: '红薯粉条配花生碎、榨菜与香菜，酸辣汤底，重庆风味。' },
  { name: '重庆小面', cat: '1,2,2', price: '15', num: 70, weight: '400g', hot: 0,
    desc: '碱水面配红油、花椒面与豌豆，麻辣鲜香。' },
  { name: '三鲜馄饨', cat: '1,2,2', price: '18', num: 60, weight: '400g', hot: 0,
    desc: '猪肉虾仁馅大馄饨，紫菜蛋皮清汤，共 8 只。' },

  // ===== 经典奶茶 2,1,1 =====
  { id: 10, name: '珍珠奶茶（大杯）', cat: '2,1,1', price: '12', num: 120, weight: '700ml', hot: 1,
    desc: '红茶底配鲜牛乳与手煮黑糖珍珠，大杯 700ml，默认七分糖。' },
  { id: 11, name: '黑糖波霸鲜奶', cat: '2,1,1', price: '16', num: 80, weight: '500ml', hot: 0,
    desc: '黑糖熬煮波霸挂壁，加鲜牛乳，喝前摇匀，甜而不腻。' },
  { name: '原味奶茶', cat: '2,1,1', price: '10', num: 100, weight: '500ml', hot: 0,
    desc: '锡兰红茶配鲜奶，经典原味，甜度可调。' },
  { name: '芋泥波波奶茶', cat: '2,1,1', price: '16', num: 80, weight: '500ml', hot: 0,
    desc: '手作芋泥打底，配波波与鲜奶茶，芋香绵密。' },
  { name: '抹茶奶绿', cat: '2,1,1', price: '14', num: 80, weight: '500ml', hot: 0,
    desc: '宇治抹茶粉配鲜奶与绿茶底，微苦回甘。' },

  // ===== 鲜果茶 2,1,2 =====
  { name: '满杯百香果', cat: '2,1,2', price: '15', num: 90, weight: '500ml', hot: 1,
    desc: '两颗百香果现挖果肉，配茉莉绿茶与青柠，酸甜带籽。' },
  { name: '杨枝甘露', cat: '2,1,2', price: '18', num: 70, weight: '500ml', hot: 0,
    desc: '芒果泥配西柚粒、西米与椰浆，冰镇后口感更佳。' },
  { name: '多肉葡萄', cat: '2,1,2', price: '19', num: 70, weight: '500ml', hot: 0,
    desc: '现剥巨峰葡萄果肉，配茉莉绿茶，果肉给量足。' },
  { name: '柠檬蜜茶', cat: '2,1,2', price: '12', num: 90, weight: '500ml', hot: 0,
    desc: '黄柠檬现切捶打出汁，配蜂蜜绿茶，清爽解腻。' },

  // ===== 鲜榨果汁 2,2 =====
  { id: 12, name: '鲜榨柠檬水', cat: '2,2', price: '8', num: 150, weight: '450ml', hot: 0,
    desc: '黄柠檬现榨，加冰水与少量蜂蜜，无香精无浓缩汁。' },
  { name: '鲜榨橙汁', cat: '2,2', price: '16', num: 80, weight: '450ml', hot: 0,
    desc: '赣南脐橙现榨，约三个橙子一杯，不加水不加糖。' },
  { name: '西瓜汁', cat: '2,2', price: '14', num: 80, weight: '450ml', hot: 0,
    desc: '当季西瓜现榨滤渣，清凉解暑。' },
  { name: '芒果汁', cat: '2,2', price: '16', num: 70, weight: '450ml', hot: 0,
    desc: '台农芒果现打，果肉浓稠，可加冰。' },

  // ===== 凉菜卤味 3,1 =====
  { name: '拍黄瓜', cat: '3,1', price: '10', num: 100, weight: '250g', hot: 0,
    desc: '黄瓜拍裂配蒜末、香醋与香油，爽脆开胃。' },
  { name: '凉拌木耳', cat: '3,1', price: '12', num: 90, weight: '250g', hot: 0,
    desc: '黑木耳泡发焯水，配小米辣与陈醋，脆爽微辣。' },
  { name: '卤味拼盘', cat: '3,1', price: '28', num: 50, weight: '300g', hot: 0,
    desc: '卤牛肉、卤蛋、卤豆干与卤鸡爪拼盘，老卤入味。' },
  { name: '口水鸡', cat: '3,1', price: '26', num: 50, weight: '350g', hot: 0,
    desc: '鸡腿肉浸熟冰镇，浇红油、花椒面与花生碎，麻辣鲜香。' },

  // ===== 炸物点心 3,2 =====
  { name: '香酥鸡米花', cat: '3,2', price: '16', num: 90, weight: '200g', hot: 0,
    desc: '鸡胸肉丁裹脆浆炸至金黄，配番茄酱。' },
  { name: '黄金薯条', cat: '3,2', price: '10', num: 100, weight: '150g', hot: 0,
    desc: '粗切薯条现炸，外脆内绵，配番茄酱。' },
  { name: '炸鸡翅（4只）', cat: '3,2', price: '22', num: 60, weight: '260g', hot: 1,
    desc: '鸡中翅腌制后裹粉现炸，外皮酥脆，共 4 只。' },
  { name: '春卷（6只）', cat: '3,2', price: '12', num: 80, weight: '180g', hot: 0,
    desc: '韭黄肉丝馅春卷现炸，共 6 只，配甜辣酱。' },
  { name: '红糖糍粑', cat: '3,2', price: '14', num: 70, weight: '200g', hot: 0,
    desc: '糯米糍粑炸至微脆，淋红糖浆与黄豆粉。' }
]

// 可选规格：写 cateparams，(attr_name, cat_id) 为唯一键
// cat_id 用 JSON 数组字符串，与 cateparams 既有格式保持一致
// 注：点餐端不展示「份量」，因为当前没有按规格加价的规则，避免误导
const specs = [
  { name: '辣度', cat: '[1,1,1]', vals: '不辣,微辣,中辣,重辣' },
  { name: '辣度', cat: '[1,1,2]', vals: '不辣,微辣,中辣,重辣' },
  { name: '糖度', cat: '[2,1,1]', vals: '无糖,三分糖,五分糖,七分糖,全糖' },
  { name: '糖度', cat: '[2,1,2]', vals: '无糖,三分糖,五分糖,七分糖,全糖' },
  { name: '冰量', cat: '[2,1,1]', vals: '常温,少冰,正常冰,去冰' },
  { name: '冰量', cat: '[2,1,2]', vals: '常温,少冰,正常冰,去冰' },
  { name: '冰量', cat: '[2,2]', vals: '常温,少冰,去冰' }
]

module.exports = { tree, dishes, specs }

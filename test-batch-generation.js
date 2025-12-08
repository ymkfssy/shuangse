// 测试批量号码生成功能
const { generateNewNumbers, generateNewNumber } = require('./src/lottery.js');

console.log('=== 测试批量号码生成功能 ===\n');

// 测试生成1个号码
console.log('1. 测试生成1个号码:');
try {
    const result1 = generateNewNumber();
    console.log('   成功生成单个号码:');
    console.log('   红球:', result1.numbers.red.join(', '));
    console.log('   蓝球:', result1.numbers.blue);
    console.log('');
} catch (error) {
    console.log('   生成单个号码失败:', error.message);
}

// 测试生成5个号码
console.log('2. 测试生成5个号码:');
try {
    const result5 = generateNewNumbers(5);
    console.log('   成功生成5个号码:');
    result5.numbers.forEach((num, index) => {
        console.log(\`   第\${index + 1}组: 红球[\${num.red.join(', ')}] 蓝球[\${num.blue}]\`);
    });
    console.log('');
} catch (error) {
    console.log('   生成5个号码失败:', error.message);
}

// 测试生成10个号码（最大数量）
console.log('3. 测试生成10个号码:');
try {
    const result10 = generateNewNumbers(10);
    console.log('   成功生成10个号码:');
    console.log('   共生成', result10.numbers.length, '组号码');
    
    // 检查是否有重复号码
    const allNumbers = new Set();
    let hasDuplicates = false;
    
    result10.numbers.forEach((num, index) => {
        const numberStr = \`\${num.red.sort().join('-')}-\${num.blue}\`;
        if (allNumbers.has(numberStr)) {
            hasDuplicates = true;
            console.log(\`   警告: 第\${index + 1}组号码重复\`);
        }
        allNumbers.add(numberStr);
    });
    
    if (!hasDuplicates) {
        console.log('   所有号码组均不重复');
    }
    console.log('');
} catch (error) {
    console.log('   生成10个号码失败:', error.message);
}

console.log('=== 测试完成 ===');
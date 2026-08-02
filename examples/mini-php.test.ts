import { describe, expect, test } from 'bun:test'
import { runPhp, parsePhp } from './mini-php'

describe('mini-php', () => {
  // ─── Parsing ─────────────────────────────────────────────────────

  test('parsePhp returns AST', () => {
    const ast = parsePhp('<?php $x = 1; ?>') as any
    expect(ast.tag).toBe('Program')
    expect(ast.statements.length).toBe(1)
  })

  test('tanpa tag <?php error', () => {
    expect(() => runPhp('echo 1;')).toThrow()
  })

  test('program kosong', () => {
    expect(runPhp('<?php ?>')).toBe('')
    expect(runPhp('<?php')).toBe('')
  })

  // ─── Echo ────────────────────────────────────────────────────────

  test('echo angka', () => {
    expect(runPhp('<?php echo 42; ?>')).toBe('42')
  })

  test('echo string double quote', () => {
    expect(runPhp('<?php echo "hello"; ?>')).toBe('hello')
  })

  test('echo string single quote', () => {
    expect(runPhp("<?php echo 'halo'; ?>")).toBe('halo')
  })

  test('echo multiple args tanpa separator', () => {
    expect(runPhp('<?php echo 1, 2, 3; ?>')).toBe('123')
    expect(runPhp('<?php echo "a", "b", "c"; ?>')).toBe('abc')
  })

  test('echo tanpa tag penutup', () => {
    expect(runPhp('<?php echo "open";')).toBe('open')
  })

  test('echo bool ala php', () => {
    expect(runPhp('<?php echo true; ?>')).toBe('1')
    expect(runPhp('<?php echo false; ?>')).toBe('')
  })

  test('echo null', () => {
    expect(runPhp('<?php echo null; ?>')).toBe('')
    expect(runPhp('<?php $x = null; echo $x; ?>')).toBe('')
  })

  // ─── Aritmatika ──────────────────────────────────────────────────

  test('aritmatika dasar', () => {
    expect(runPhp('<?php echo 1 + 2; ?>')).toBe('3')
    expect(runPhp('<?php echo 5 - 2; ?>')).toBe('3')
    expect(runPhp('<?php echo 3 * 4; ?>')).toBe('12')
    expect(runPhp('<?php echo 10 / 2; ?>')).toBe('5')
    expect(runPhp('<?php echo 7 % 2; ?>')).toBe('1')
  })

  test('pembagian menghasilkan float', () => {
    expect(runPhp('<?php echo 7 / 2; ?>')).toBe('3.5')
  })

  test('precedence operator', () => {
    expect(runPhp('<?php echo 1 + 2 * 3; ?>')).toBe('7')
    expect(runPhp('<?php echo (1 + 2) * 3; ?>')).toBe('9')
  })

  test('left associative', () => {
    expect(runPhp('<?php echo 10 - 3 - 2; ?>')).toBe('5')
  })

  test('unary minus', () => {
    expect(runPhp('<?php echo -5; ?>')).toBe('-5')
    expect(runPhp('<?php echo -5 + 2; ?>')).toBe('-3')
    expect(runPhp('<?php echo 2 * -3; ?>')).toBe('-6')
    expect(runPhp('<?php echo 10 - -3; ?>')).toBe('13')
  })

  test('float literal', () => {
    expect(runPhp('<?php echo 3.14; ?>')).toBe('3.14')
    expect(runPhp('<?php echo 0.5; ?>')).toBe('0.5')
  })

  test('division by zero error', () => {
    expect(() => runPhp('<?php echo 1 / 0; ?>')).toThrow()
  })

  // ─── Konkatenasi ─────────────────────────────────────────────────

  test('konkatenasi titik', () => {
    expect(runPhp('<?php echo "foo" . "bar"; ?>')).toBe('foobar')
    expect(runPhp('<?php echo "x" . 5; ?>')).toBe('x5')
    expect(runPhp('<?php echo 1 . 2 . 3; ?>')).toBe('123')
    expect(runPhp('<?php echo true . "!"; ?>')).toBe('1!')
  })

  test('konkatenasi dengan spasi', () => {
    expect(runPhp('<?php echo 5 . 5; ?>')).toBe('55')
  })

  // ─── Variabel ────────────────────────────────────────────────────

  test('variabel', () => {
    expect(runPhp('<?php $x = 5; echo $x; ?>')).toBe('5')
    expect(runPhp('<?php $nama = "Budi"; echo $nama; ?>')).toBe('Budi')
  })

  test('assignment berantai', () => {
    expect(runPhp('<?php $x = 2; $y = $x * 3; echo $y; ?>')).toBe('6')
  })

  test('reassignment', () => {
    expect(runPhp('<?php $x = 1; $x = $x + 2; echo $x; ?>')).toBe('3')
  })

  test('variabel undefined error', () => {
    expect(() => runPhp('<?php echo $x; ?>')).toThrow()
  })

  // ─── Interpolasi string ──────────────────────────────────────────

  test('interpolasi variabel di double quote', () => {
    expect(runPhp('<?php $nama = "Budi"; echo "Halo $nama!"; ?>')).toBe('Halo Budi!')
    expect(runPhp('<?php $x = 7; echo "nilai $x ok"; ?>')).toBe('nilai 7 ok')
  })

  test('single quote tidak interpolasi', () => {
    expect(runPhp("<?php $nama = 'Budi'; echo '$nama'; ?>")).toBe('$nama')
  })

  test('escape dollar', () => {
    expect(runPhp('<?php echo "Harga: \\$5"; ?>')).toBe('Harga: $5')
  })

  test('escape string', () => {
    expect(runPhp('<?php echo "a\\nb\\tc\\""; ?>')).toBe('a\nb\tc"')
  })

  // ─── Perbandingan & Logika ───────────────────────────────────────

  test('comparison', () => {
    expect(runPhp('<?php echo 1 < 2; ?>')).toBe('1')
    expect(runPhp('<?php echo 1 > 2; ?>')).toBe('')
    expect(runPhp('<?php echo 2 == 2; ?>')).toBe('1')
    expect(runPhp('<?php echo 2 != 2; ?>')).toBe('')
    expect(runPhp('<?php echo 3 <= 3; ?>')).toBe('1')
    expect(runPhp('<?php echo 3 >= 4; ?>')).toBe('')
  })

  test('equality longgar ala php', () => {
    expect(runPhp('<?php echo 1 == "1"; ?>')).toBe('1')
    expect(runPhp('<?php echo null == ""; ?>')).toBe('1')
    expect(runPhp('<?php echo false == 0; ?>')).toBe('1')
  })

  test('strict equality', () => {
    expect(runPhp('<?php echo 1 === 1; ?>')).toBe('1')
    expect(runPhp('<?php echo 1 === "1"; ?>')).toBe('')
    expect(runPhp('<?php echo 1 !== "1"; ?>')).toBe('1')
  })

  test('logika && dan ||', () => {
    expect(runPhp('<?php echo true && false; ?>')).toBe('')
    expect(runPhp('<?php echo true || false; ?>')).toBe('1')
    expect(runPhp('<?php echo !false; ?>')).toBe('1')
  })

  test('comparison string', () => {
    expect(runPhp('<?php echo "abc" < "abd"; ?>')).toBe('1')
  })

  // ─── If / Elseif / Else ──────────────────────────────────────────

  test('if else', () => {
    const code = `<?php
$x = 5;
if ($x > 3) {
  echo "gede";
} else {
  echo "cilik";
}`
    expect(runPhp(code)).toBe('gede')
  })

  test('if false ambil else', () => {
    const code = `<?php
$x = 1;
if ($x > 3) {
  echo "gede";
} else {
  echo "cilik";
}`
    expect(runPhp(code)).toBe('cilik')
  })

  test('elseif chain', () => {
    const code = `<?php
$x = 2;
if ($x == 1) {
  echo "satu";
} elseif ($x == 2) {
  echo "dua";
} elseif ($x == 3) {
  echo "tiga";
} else {
  echo "lain";
}`
    expect(runPhp(code)).toBe('dua')
  })

  test('elseif tanpa else', () => {
    const code = `<?php
$x = 9;
if ($x == 1) {
  echo "satu";
} elseif ($x == 2) {
  echo "dua";
}`
    expect(runPhp(code)).toBe('')
  })

  test('if tanpa block statement', () => {
    const code = `<?php
if (true) {
  echo "ya";
}`
    expect(runPhp(code)).toBe('ya')
  })

  test('nested if', () => {
    const code = `<?php
$x = 10;
if ($x > 5) {
  if ($x > 8) {
    echo "gede banget";
  } else {
    echo "gede";
  }
} else {
  echo "cilik";
}`
    expect(runPhp(code)).toBe('gede banget')
  })

  test('if tanpa braces', () => {
    const code = `<?php
function cek($n) {
  if ($n <= 1) return "kecil";
  else return "gede";
}
echo cek(0);
echo cek(5);`
    expect(runPhp(code)).toBe('kecilgede')
  })

  test('while tanpa braces', () => {
    const code = `<?php
$i = 0;
while ($i < 3) echo $i++;
echo $i;`
    expect(runPhp(code)).toBe('0123')
  })

  test('variabel dari block tetap terlihat', () => {
    const code = `<?php
if (true) {
  $x = 7;
}
echo $x;`
    expect(runPhp(code)).toBe('7')
  })

  // ─── While ───────────────────────────────────────────────────────

  test('while loop', () => {
    const code = `<?php
$i = 0;
while ($i < 3) {
  echo $i;
  $i = $i + 1;
}`
    expect(runPhp(code)).toBe('012')
  })

  test('while sum', () => {
    const code = `<?php
$total = 0;
$i = 1;
while ($i <= 10) {
  $total = $total + $i;
  $i++;
}
echo $total;`
    expect(runPhp(code)).toBe('55')
  })

  // ─── For ─────────────────────────────────────────────────────────

  test('for loop dengan postfix increment', () => {
    const code = `<?php
for ($i = 0; $i < 3; $i++) {
  echo $i, "\\n";
}`
    expect(runPhp(code)).toBe('0\n1\n2\n')
  })

  test('for loop dengan assignment update', () => {
    const code = `<?php
for ($i = 1; $i <= 3; $i = $i + 1) {
  echo $i;
}`
    expect(runPhp(code)).toBe('123')
  })

  test('for tanpa init', () => {
    const code = `<?php
$i = 0;
for (; $i < 2; $i++) {
  echo $i;
}`
    expect(runPhp(code)).toBe('01')
  })

  // ─── Postfix & Prefix Increment ──────────────────────────────────

  test('postfix increment nilai lama', () => {
    expect(runPhp('<?php $i = 0; echo $i++; echo $i; ?>')).toBe('01')
  })

  test('prefix increment nilai baru', () => {
    expect(runPhp('<?php $i = 0; echo ++$i; ?>')).toBe('1')
    expect(runPhp('<?php $i = 0; echo --$i; ?>')).toBe('-1')
  })

  // ─── Fungsi ──────────────────────────────────────────────────────

  test('fungsi tanpa param', () => {
    const code = `<?php
function sapa() {
  echo "halo";
}
sapa();`
    expect(runPhp(code)).toBe('halo')
  })

  test('fungsi dengan param', () => {
    const code = `<?php
function tambah($a, $b) {
  echo $a + $b;
}
tambah(3, 4);`
    expect(runPhp(code)).toBe('7')
  })

  test('fungsi dengan return', () => {
    const code = `<?php
function duaKali($x) {
  return $x * 2;
}
echo duaKali(5);`
    expect(runPhp(code)).toBe('10')
  })

  test('fungsi tanpa return menghasilkan null', () => {
    const code = `<?php
function kosong() {
  echo "dipanggil";
}
echo kosong();`
    expect(runPhp(code)).toBe('dipanggil')
  })

  test('recursive fibonacci', () => {
    const code = `<?php
function fib($n) {
  if ($n <= 1) {
    return $n;
  }
  return fib($n - 1) + fib($n - 2);
}
echo fib(7);`
    expect(runPhp(code)).toBe('13')
  })

  test('fungsi bisa akses variabel dari luar', () => {
    const code = `<?php
$x = 10;
function coba() {
  echo $x;
}
coba();`
    expect(runPhp(code)).toBe('10')
  })

  test('param fungsi adalah copy', () => {
    const code = `<?php
function ubah($a) {
  $a = 99;
}
$x = 5;
ubah($x);
echo $x;`
    expect(runPhp(code)).toBe('5')
  })

  // ─── Builtin ─────────────────────────────────────────────────────

  test('builtin strlen', () => {
    expect(runPhp('<?php echo strlen("halo"); ?>')).toBe('4')
  })

  test('builtin strtoupper & strtolower', () => {
    expect(runPhp('<?php echo strtoupper("halo"); ?>')).toBe('HALO')
    expect(runPhp('<?php echo strtolower("HALO"); ?>')).toBe('halo')
  })

  test('builtin count', () => {
    expect(runPhp('<?php echo count([10, 20, 30]); ?>')).toBe('3')
    expect(runPhp('<?php echo count([]); ?>')).toBe('0')
  })

  test('builtin str_repeat', () => {
    expect(runPhp('<?php echo str_repeat("ab", 3); ?>')).toBe('ababab')
  })

  test('nested function call', () => {
    expect(runPhp('<?php echo strtoupper("halo " . "dunia"); ?>')).toBe('HALO DUNIA')
  })

  test('undefined function error', () => {
    expect(() => runPhp('<?php nggakAda(1); ?>')).toThrow()
  })

  // ─── Array ───────────────────────────────────────────────────────

  test('array literal dan index', () => {
    expect(runPhp('<?php $a = [10, 20, 30]; echo $a[1]; ?>')).toBe('20')
  })

  test('array kosong', () => {
    expect(runPhp('<?php $a = []; echo count($a); ?>')).toBe('0')
  })

  test('index pakai variabel', () => {
    expect(runPhp('<?php $a = [5, 6, 7]; $i = 2; echo $a[$i]; ?>')).toBe('7')
  })

  test('index out of range error', () => {
    expect(() => runPhp('<?php $a = [1]; echo $a[5]; ?>')).toThrow()
  })

  test('string bisa diindex', () => {
    expect(runPhp('<?php $s = "abc"; echo $s[1]; ?>')).toBe('b')
  })

  test('echo array jadi "Array"', () => {
    expect(runPhp('<?php echo [1, 2]; ?>')).toBe('Array')
  })

  // ─── Komentar ────────────────────────────────────────────────────

  test('komentar single line //', () => {
    expect(runPhp('<?php // komentar\n echo 1; ?>')).toBe('1')
  })

  test('komentar hash #', () => {
    expect(runPhp('<?php # komentar\n echo 2; ?>')).toBe('2')
  })

  test('komentar multi line', () => {
    expect(runPhp('<?php /* komentar */ echo 3; ?>')).toBe('3')
  })

  // ─── Statement kosong ────────────────────────────────────────────

  test('statement kosong ;', () => {
    expect(runPhp('<?php ; echo 1; ?>')).toBe('1')
  })

  // ─── Echo shorthand <?= ──────────────────────────────────────────

  test('echo shorthand <?=', () => {
    expect(runPhp('<?= 1 + 2 ?>')).toBe('3')
    expect(runPhp('<?= "halo" ?>')).toBe('halo')
  })

  test('echo shorthand dengan semicolon', () => {
    expect(runPhp('<?= 2 * 3; ?>')).toBe('6')
  })

  test('echo shorthand dengan fungsi', () => {
    expect(runPhp('<?= strtoupper("halo") ?>')).toBe('HALO')
    expect(runPhp('<?= "halo" . " dunia" ?>')).toBe('halo dunia')
  })

  // ─── Kasus lengkap ───────────────────────────────────────────────

  test('fizzbuzz', () => {
    const code = `<?php
for ($i = 1; $i <= 15; $i++) {
  if ($i % 15 == 0) {
    echo "FizzBuzz\\n";
  } elseif ($i % 3 == 0) {
    echo "Fizz\\n";
  } elseif ($i % 5 == 0) {
    echo "Buzz\\n";
  } else {
    echo $i, "\\n";
  }
}`
    expect(runPhp(code)).toBe('1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz\n')
  })

  test('fungsi + loop + array', () => {
    const code = `<?php
function jumlah($arr) {
  $total = 0;
  for ($i = 0; $i < count($arr); $i++) {
    $total = $total + $arr[$i];
  }
  return $total;
}
echo "total: " . jumlah([1, 2, 3, 4, 5]);`
    expect(runPhp(code)).toBe('total: 15')
  })

  test('syntax error', () => {
    expect(() => runPhp('<?php $x = ; ?>')).toThrow()
  })
})

insert into public.problems(id,slug,title,difficulty,statement,input_format,output_format,constraints,time_limit_ms,memory_limit_mb,published)
values
('a0000000-0000-4000-8000-000000000001','a-plus-b','A + B','Easy',
$md$Read two integers and print their sum.

This is a warm-up for reading input and producing output. The integers can be negative.$md$,
'A single line containing two integers $A$ and $B$.',
'Print one integer: $A+B$.',
'- $-10^9 \le A,B \le 10^9$',1000,128,true),
('a0000000-0000-4000-8000-000000000002','count-distinct','Count Distinct','Easy',
$md$Given a list of integers, count how many different values appear in it.

For example, the values $1,2,2,4,1$ contain three distinct integers: $1$, $2$, and $4$.$md$,
'The first line contains an integer $N$. The second line contains $N$ integers $a_1,a_2,\ldots,a_N$.',
'Print the number of distinct values in the list.',
'- $1 \le N \le 200{,}000$
- $-10^9 \le a_i \le 10^9$',1500,256,true),
('a0000000-0000-4000-8000-000000000003','range-sum-queries','Range Sum Queries','Medium',
$md$You are given an array of integers and $Q$ queries. Each query asks for the sum of the elements in a range of the array.

The range endpoints are **1-indexed** and inclusive. Your solution should answer all queries efficiently.$md$,
'The first line contains two integers $N$ and $Q$. The second line contains $N$ integers $a_1,\ldots,a_N$. Each of the next $Q$ lines contains two integers $L$ and $R$, describing one query.',
'For each query, print the sum $a_L+a_{L+1}+\cdots+a_R$ on its own line.',
'- $1 \le N,Q \le 200{,}000$
- $1 \le L \le R \le N$
- $-10^9 \le a_i \le 10^9$
- The absolute value of every answer is at most $2\cdot 10^{14}$.',2000,256,true)
on conflict(slug) do update set title=excluded.title,difficulty=excluded.difficulty,statement=excluded.statement,input_format=excluded.input_format,output_format=excluded.output_format,constraints=excluded.constraints,time_limit_ms=excluded.time_limit_ms,memory_limit_mb=excluded.memory_limit_mb,published=true,updated_at=now();

insert into public.problem_tags(problem_id,tag) values
('a0000000-0000-4000-8000-000000000001','implementation'),('a0000000-0000-4000-8000-000000000001','math'),
('a0000000-0000-4000-8000-000000000002','arrays'),('a0000000-0000-4000-8000-000000000002','sets'),
('a0000000-0000-4000-8000-000000000003','arrays'),('a0000000-0000-4000-8000-000000000003','prefix sums')
on conflict do nothing;

insert into public.test_cases(problem_id,case_index,input,expected_output,is_sample,explanation) values
('a0000000-0000-4000-8000-000000000001',0,E'1 2\n',E'3\n',true,'The sum of 1 and 2 is 3.'),
('a0000000-0000-4000-8000-000000000001',1,E'-4 7\n',E'3\n',true,'Adding a negative number is the same as subtracting its absolute value.'),
('a0000000-0000-4000-8000-000000000001',2,E'0 0\n',E'0\n',false,null),
('a0000000-0000-4000-8000-000000000001',3,E'1000000000 1000000000\n',E'2000000000\n',false,null),
('a0000000-0000-4000-8000-000000000001',4,E'-1000000000 999999999\n',E'-1\n',false,null),
('a0000000-0000-4000-8000-000000000001',5,E'-17 -28\n',E'-45\n',false,null),
('a0000000-0000-4000-8000-000000000002',0,E'8\n1 2 2 3 1 4 3 5\n',E'5\n',true,'The distinct values are 1, 2, 3, 4, and 5.'),
('a0000000-0000-4000-8000-000000000002',1,E'5\n-2 -2 -2 -2 -2\n',E'1\n',true,'Every element has the same value.'),
('a0000000-0000-4000-8000-000000000002',2,E'1\n42\n',E'1\n',false,null),
('a0000000-0000-4000-8000-000000000002',3,E'6\n-1 0 1 2 3 4\n',E'6\n',false,null),
('a0000000-0000-4000-8000-000000000002',4,E'7\n1000000000 -1000000000 1000000000 -1000000000 5 5 5\n',E'3\n',false,null),
('a0000000-0000-4000-8000-000000000002',5,E'10\n1 2 3 4 5 6 7 8 9 10\n',E'10\n',false,null),
('a0000000-0000-4000-8000-000000000003',0,E'5 4\n1 2 3 4 5\n1 3\n2 5\n1 5\n3 3\n',E'6\n14\n15\n3\n',true,'Each answer adds the values in the inclusive range.'),
('a0000000-0000-4000-8000-000000000003',1,E'4 3\n-5 10 -2 7\n1 4\n2 3\n4 4\n',E'10\n8\n7\n',true,'The array contains negative values, which are included in the sums.'),
('a0000000-0000-4000-8000-000000000003',2,E'1 2\n1000000000\n1 1\n1 1\n',E'1000000000\n1000000000\n',false,null),
('a0000000-0000-4000-8000-000000000003',3,E'6 3\n1 2 3 4 5 6\n1 6\n2 5\n3 4\n',E'21\n14\n7\n',false,null),
('a0000000-0000-4000-8000-000000000003',4,E'5 2\n-1 -2 -3 -4 -5\n1 5\n2 4\n',E'-15\n-9\n',false,null),
('a0000000-0000-4000-8000-000000000003',5,E'3 3\n1000000000 1000000000 1000000000\n1 3\n1 2\n2 3\n',E'3000000000\n2000000000\n2000000000\n',false,null)
on conflict(problem_id,case_index) do update set input=excluded.input,expected_output=excluded.expected_output,is_sample=excluded.is_sample,explanation=excluded.explanation;

insert into public.reference_solutions(problem_id,python,cpp,published) values
('a0000000-0000-4000-8000-000000000001',
$py$import sys
a, b = map(int, sys.stdin.read().split())
print(a + b)$py$,
$cpp$#include <bits/stdc++.h>
using namespace std;
int main() {
    long long a, b;
    cin >> a >> b;
    cout << a + b << '\n';
}$cpp$,false),
('a0000000-0000-4000-8000-000000000002',
$py$import sys
data = list(map(int, sys.stdin.buffer.read().split()))
n = data[0]
print(len(set(data[1:1 + n])))$py$,
$cpp$#include <bits/stdc++.h>
using namespace std;
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n;
    cin >> n;
    unordered_set<long long> values;
    for (int i = 0; i < n; ++i) {
        long long value;
        cin >> value;
        values.insert(value);
    }
    cout << values.size() << '\n';
}$cpp$,false),
('a0000000-0000-4000-8000-000000000003',
$py$import sys
data = list(map(int, sys.stdin.buffer.read().split()))
n, q = data[0], data[1]
array = data[2:2 + n]
prefix = [0] * (n + 1)
for i, value in enumerate(array, 1):
    prefix[i] = prefix[i - 1] + value
pos = 2 + n
answers = []
for _ in range(q):
    left, right = data[pos], data[pos + 1]
    pos += 2
    answers.append(str(prefix[right] - prefix[left - 1]))
print("\n".join(answers))$py$,
$cpp$#include <bits/stdc++.h>
using namespace std;
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n, q;
    cin >> n >> q;
    vector<long long> prefix(n + 1);
    for (int i = 1; i <= n; ++i) {
        long long value;
        cin >> value;
        prefix[i] = prefix[i - 1] + value;
    }
    while (q--) {
        int left, right;
        cin >> left >> right;
        cout << prefix[right] - prefix[left - 1] << '\n';
    }
}$cpp$,false)
on conflict(problem_id) do update set python=excluded.python,cpp=excluded.cpp,published=false,updated_at=now();

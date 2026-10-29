"""Build bench/routing-benchmark.xlsx from bench/prompts.json and bench/results.json.

Usage: python3 -I bench/build_workbook.py <prompts.json> <results.json> <out.xlsx>
Every derived number (tiers, accuracy, cost) is a formula over the Results and Prompts sheets,
so changing a threshold in Settings or an expected range in Prompts recalculates the summary.
"""
import json
import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.formatting.rule import ColorScaleRule
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

FONT = 'Arial'
BLUE = Font(name=FONT, color='0000FF')
BOLD = Font(name=FONT, bold=True)
HEAD_FILL = PatternFill('solid', start_color='DDEBF7')
INPUT_FILL = PatternFill('solid', start_color='FFFF00')


def style_header(ws, row: int, cols: int) -> None:
    for c in range(1, cols + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = BOLD
        cell.fill = HEAD_FILL
        cell.alignment = Alignment(wrap_text=True, vertical='top')


def widths(ws, sizes: list[int]) -> None:
    for i, w in enumerate(sizes, 1):
        ws.column_dimensions[get_column_letter(i)].width = w


def tier_of(ref: str) -> str:
    return f'IF({ref}<=Settings!$B$3,"simple",IF({ref}<=Settings!$B$4,"coding","critical"))'


def settings_sheet(wb: Workbook) -> None:
    ws = wb.active
    ws.title = 'Settings'
    rows = [
        ('Routing benchmark: which model routes best', None),
        ('Setting', 'Value'),
        ('Simple tier: score at or below', 3),
        ('Coding tier: score at or below (above is critical)', 7),
    ]
    for r, (a, b) in enumerate(rows, 1):
        ws.cell(row=r, column=1, value=a).font = BOLD if r <= 2 else Font(name=FONT)
        if b is not None:
            ws.cell(row=r, column=2, value=b)
    for r in (3, 4):
        ws.cell(row=r, column=2).font = BLUE
        ws.cell(row=r, column=2).fill = INPUT_FILL
    ws['B3'].comment = Comment('The mod\'s default thresholds (router.thresholds in model-config.json).', 'bench')
    notes = [
        '',
        'How to read this workbook',
        'Prompts: 32 labelled tasks, from creating a text file to a multi-tenant B2B SaaS. Min/Max is the score range a good router should give on the mod\'s blast-radius rubric; edit them (yellow) if you disagree.',
        'Results: one row per model and prompt: the model\'s raw reply, the verdict the mod would parse from it, and its time and cost.',
        'Summary: per model, how often it routed to an acceptable tier, how often it under-scored risky work (critical expected, routed below), and what routing 1,000 prompts would cost.',
        'Method: each model was asked the mod\'s exact classifier question (hooks/lib/classify.js classifierPrompt) once per prompt on 2026-10-29, and its reply parsed with the mod\'s parseVerdict rule.',
        'Palgu models: Anthropic API on api.palgu.ai, pinned with x-srooter-pin, max 400 output tokens; cost is Palgu\'s own /v1/pricing/quote for the usage returned.',
        'Claude models: claude -p on the user\'s login with a minimal system prompt; cost estimated at API list prices (Haiku 5.5 $0.10/$0.50, Haiku 4.5 $1/$5, Sonnet 5.5 $2/$10 per million) from the question size (~4 characters a token) and the reported output tokens, which include thinking.',
        'Not run: the local Ollama classifier (qwen2.5-coder:3b), because Ollama was not running.',
        'Legend: blue text with a yellow fill = an input you may change. Black = a formula.',
    ]
    for i, t in enumerate(notes, 6):
        ws.cell(row=i, column=1, value=t).font = BOLD if t == 'How to read this workbook' else Font(name=FONT)
        ws.cell(row=i, column=1).alignment = Alignment(wrap_text=True, vertical='top')
        ws.merge_cells(start_row=i, start_column=1, end_row=i, end_column=6)
        ws.row_dimensions[i].height = 15 if len(t) < 90 else 45
    widths(ws, [52, 12, 14, 14, 14, 14])


def prompts_sheet(wb: Workbook, prompts: list[dict]) -> None:
    ws = wb.create_sheet('Prompts')
    head = ['ID', 'Category', 'Prompt', 'Expected min score', 'Expected max score', 'Expected kind', 'Lowest acceptable tier', 'Highest acceptable tier']
    ws.append(head)
    style_header(ws, 1, len(head))
    for i, p in enumerate(prompts, 2):
        ws.append([p['id'], p['category'], p['prompt'], p['min'], p['max'], p['kind'], f'={tier_of(f"D{i}")}', f'={tier_of(f"E{i}")}'])
        for c in (4, 5, 6):
            ws.cell(row=i, column=c).font = BLUE
            ws.cell(row=i, column=c).fill = INPUT_FILL
        for c in (1, 2, 3, 7, 8):
            ws.cell(row=i, column=c).font = Font(name=FONT)
        ws.cell(row=i, column=3).alignment = Alignment(wrap_text=True, vertical='top')
    ws.freeze_panes = 'A2'
    widths(ws, [5, 15, 70, 10, 10, 12, 12, 12])


RESULT_HEAD = ['Model', 'Prompt ID', 'Raw reply', 'Score', 'Kind', 'Routed tier', 'Expected min', 'Expected max',
               'Tier OK', 'Score in range', 'Kind OK', 'Risky misroute', 'Seconds', 'Tokens in', 'Tokens out',
               'Cost ($)', 'Served model', 'Error']


def result_formulas(r: int) -> list[str]:
    look = lambda col: f'INDEX(Prompts!${col}$2:${col}$200,MATCH($B{r},Prompts!$A$2:$A$200,0))'
    return [
        f'=IF(D{r}="","none",{tier_of(f"D{r}")})',
        f'={look("D")}',
        f'={look("E")}',
        f'=IF(D{r}="",0,IF(OR(F{r}={tier_of(f"G{r}")},F{r}={tier_of(f"H{r}")}),1,0))',
        f'=IF(D{r}="",0,IF(AND(D{r}>=G{r},D{r}<=H{r}),1,0))',
        f'=IF(E{r}={look("F")},1,0)',
        f'=IF(AND(G{r}>Settings!$B$4,OR(D{r}="",D{r}<=Settings!$B$4)),1,0)',
    ]


def results_sheet(wb: Workbook, results: list[dict]) -> int:
    ws = wb.create_sheet('Results')
    ws.append(RESULT_HEAD)
    style_header(ws, 1, len(RESULT_HEAD))
    for r, x in enumerate(results, 2):
        values = [x['model'], x['id'], x['raw'], x['score'], x['kind'], *result_formulas(r),
                  x['seconds'], x['tokens_in'], x['tokens_out'], x['cost_usd'], x['served'], x['error']]
        ws.append(values)
        for c in range(1, len(RESULT_HEAD) + 1):
            ws.cell(row=r, column=c).font = Font(name=FONT)
        ws.cell(row=r, column=16).number_format = '$0.000000'
    ws.cell(row=1, column=12).comment = Comment('1 when the prompt needs Claude (expected min above the coding threshold) but this model scored it below critical, so a cheap model would have taken it.', 'bench')
    ws.freeze_panes = 'C2'
    ws.auto_filter.ref = f'A1:{get_column_letter(len(RESULT_HEAD))}{len(results) + 1}'
    widths(ws, [18, 8, 40, 7, 10, 10, 9, 9, 8, 9, 8, 9, 9, 9, 9, 11, 18, 30])
    return len(results) + 1


def summary_sheet(wb: Workbook, models: list[str], last: int) -> None:
    ws = wb.create_sheet('Summary', 0)
    head = ['Model', 'Prompts', 'Parsed', 'Tier accuracy', 'Score in range', 'Kind accuracy', 'Risky misroutes',
            'Avg seconds', 'Total cost ($)', 'Cost per 1,000 prompts ($)', 'Rank (tier accuracy)']
    ws.append(['Routing benchmark: which model routes best (32 prompts, 2026-10-29)'])
    ws['A1'].font = Font(name=FONT, bold=True, size=13)
    ws.append(head)
    style_header(ws, 2, len(head))
    rng = lambda col: f'Results!${col}$2:${col}${last}'
    n = len(models)
    for i, m in enumerate(models, 3):
        a = f'$A{i}'
        ws.append([
            m,
            f'=COUNTIFS({rng("A")},{a})',
            f'=COUNTIFS({rng("A")},{a},{rng("D")},"<>")',
            f'=IFERROR(SUMIFS({rng("I")},{rng("A")},{a})/B{i},0)',
            f'=IFERROR(SUMIFS({rng("J")},{rng("A")},{a})/B{i},0)',
            f'=IFERROR(SUMIFS({rng("K")},{rng("A")},{a})/B{i},0)',
            f'=SUMIFS({rng("L")},{rng("A")},{a})',
            f'=IFERROR(AVERAGEIFS({rng("M")},{rng("A")},{a}),0)',
            f'=SUMIFS({rng("P")},{rng("A")},{a})',
            f'=IFERROR(I{i}/B{i}*1000,0)',
            f'=RANK(D{i},$D$3:$D${n + 2})',
        ])
        for c in range(1, len(head) + 1):
            ws.cell(row=i, column=c).font = Font(name=FONT)
        for c in (4, 5, 6):
            ws.cell(row=i, column=c).number_format = '0.0%'
        ws.cell(row=i, column=8).number_format = '0.0'
        ws.cell(row=i, column=9).number_format = '$0.0000'
        ws.cell(row=i, column=10).number_format = '$0.000'
    end = n + 2
    ws.conditional_formatting.add(f'D3:D{end}', ColorScaleRule(start_type='min', start_color='F8696B', end_type='max', end_color='63BE7B'))
    ws.conditional_formatting.add(f'G3:G{end}', ColorScaleRule(start_type='min', start_color='63BE7B', end_type='max', end_color='F8696B'))
    ws.conditional_formatting.add(f'J3:J{end}', ColorScaleRule(start_type='min', start_color='63BE7B', end_type='max', end_color='F8696B'))
    notes = [
        'Tier accuracy: share of prompts routed to an acceptable tier (between the tiers of the expected min and max score).',
        'Risky misroutes: prompts that need Claude (critical) that the model would have sent to a cheaper model. The most important column: lower is safer.',
        'Cost per 1,000 prompts: what this model would cost as the router for 1,000 prompts, from this run. See Settings for how cost was measured.',
    ]
    for j, t in enumerate(notes, end + 2):
        ws.cell(row=j, column=1, value=t).font = Font(name=FONT, italic=True)
    ws.freeze_panes = 'B3'
    widths(ws, [20, 9, 8, 11, 11, 11, 11, 10, 12, 14, 11])


def main() -> None:
    prompts = json.loads(Path(sys.argv[1]).read_text())
    results = json.loads(Path(sys.argv[2]).read_text())
    models = sorted({r['model'] for r in results})
    wb = Workbook()
    settings_sheet(wb)
    prompts_sheet(wb, prompts)
    last = results_sheet(wb, results)
    summary_sheet(wb, models, last)
    wb.save(sys.argv[3])
    print('wrote', sys.argv[3])


if __name__ == '__main__':
    main()

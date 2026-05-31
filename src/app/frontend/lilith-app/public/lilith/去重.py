#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
重复文件查找和去重脚本
功能：扫描目录中的重复文件（基于MD5哈希），提供删除重复项的功能
"""

import os
import hashlib
from collections import defaultdict
from pathlib import Path
import sys

def get_file_hash(filepath, chunk_size=8192):
    """
    计算文件的MD5哈希值
    
    Args:
        filepath: 文件路径
        chunk_size: 每次读取的块大小
    
    Returns:
        文件的MD5哈希值字符串
    """
    hash_md5 = hashlib.md5()
    try:
        with open(filepath, 'rb') as f:
            for chunk in iter(lambda: f.read(chunk_size), b''):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    except (IOError, OSError) as e:
        print(f"无法读取文件 {filepath}: {e}")
        return None

def find_duplicates(directory):
    """
    查找目录中的重复文件
    
    Args:
        directory: 要扫描的目录路径
    
    Returns:
        字典，键为文件大小，值为按MD5分组的文件列表
    """
    # 先按文件大小分组（快速筛选）
    size_groups = defaultdict(list)
    
    # 递归扫描目录
    for root, dirs, files in os.walk(directory):
        for filename in files:
            filepath = os.path.join(root, filename)
            try:
                file_size = os.path.getsize(filepath)
                size_groups[file_size].append(filepath)
            except (IOError, OSError) as e:
                print(f"无法获取文件信息 {filepath}: {e}")
    
    # 对相同大小的文件计算MD5
    duplicates = defaultdict(list)
    
    for size, filepaths in size_groups.items():
        if len(filepaths) <= 1:
            continue
        
        print(f"检查大小相同的文件组 ({size} 字节): {len(filepaths)} 个文件")
        
        hash_groups = defaultdict(list)
        for filepath in filepaths:
            file_hash = get_file_hash(filepath)
            if file_hash:
                hash_groups[file_hash].append(filepath)
        
        # 找出MD5相同的文件（重复文件）
        for file_hash, files in hash_groups.items():
            if len(files) > 1:
                duplicates[file_hash] = files
    
    return duplicates

def format_size(size_bytes):
    """
    格式化文件大小显示
    
    Args:
        size_bytes: 字节数
    
    Returns:
        格式化后的字符串
    """
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} TB"

def display_duplicates(duplicates):
    """
    显示重复文件信息
    
    Args:
        duplicates: 重复文件字典
    
    Returns:
        重复文件组的数量
    """
    if not duplicates:
        print("\n未发现重复文件！")
        return 0
    
    group_count = 0
    total_duplicate_size = 0
    
    for file_hash, files in duplicates.items():
        group_count += 1
        # 获取文件大小
        file_size = os.path.getsize(files[0])
        total_duplicate_size += file_size * (len(files) - 1)
        
        print(f"\n{'='*70}")
        print(f"重复文件组 #{group_count}")
        print(f"MD5: {file_hash}")
        print(f"文件大小: {format_size(file_size)}")
        print(f"重复数量: {len(files)} 个文件")
        print(f"{'-'*70}")
        
        for i, filepath in enumerate(files, 1):
            print(f"{i}. {filepath}")
    
    print(f"\n{'='*70}")
    print(f"总共发现 {group_count} 组重复文件")
    print(f"可以释放的空间: {format_size(total_duplicate_size)}")
    
    return group_count

def delete_duplicates(duplicates, keep_first=True, dry_run=True):
    """
    删除重复文件
    
    Args:
        duplicates: 重复文件字典
        keep_first: 是否保留每组中的第一个文件
        dry_run: 是否为试运行（不实际删除）
    
    Returns:
        删除的文件数量
    """
    if not duplicates:
        return 0
    
    deleted_count = 0
    mode = "试运行模式（不实际删除）" if dry_run else "实际删除模式"
    
    print(f"\n{mode}")
    print("="*70)
    
    for file_hash, files in duplicates.items():
        # 保留第一个文件，删除其余文件
        files_to_delete = files[1:] if keep_first else files
        
        print(f"\n处理文件组 (MD5: {file_hash[:8]}...):")
        print(f"  保留: {files[0]}")
        
        for filepath in files_to_delete:
            if dry_run:
                print(f"  [试运行] 将删除: {filepath}")
                deleted_count += 1
            else:
                try:
                    os.remove(filepath)
                    print(f"  [已删除] {filepath}")
                    deleted_count += 1
                except (IOError, OSError) as e:
                    print(f"  [错误] 无法删除 {filepath}: {e}")
    
    return deleted_count

def main():
    """主函数"""
    print("="*70)
    print("重复文件查找和去重工具")
    print("="*70)
    
    # 获取目标目录
    if len(sys.argv) > 1:
        target_dir = sys.argv[1]
    else:
        target_dir = input("请输入要扫描的目录路径: ").strip()
    
    # 验证目录
    if not os.path.exists(target_dir):
        print(f"错误: 目录 '{target_dir}' 不存在")
        return
    
    if not os.path.isdir(target_dir):
        print(f"错误: '{target_dir}' 不是目录")
        return
    
    print(f"\n正在扫描目录: {target_dir}")
    print("这可能需要一些时间，请稍候...\n")
    
    # 查找重复文件
    duplicates = find_duplicates(target_dir)
    
    # 显示结果
    group_count = display_duplicates(duplicates)
    
    if group_count == 0:
        return
    
    # 询问用户操作
    print("\n请选择操作:")
    print("1. 显示详细信息（重新显示）")
    print("2. 删除重复文件（保留每组第一个）")
    print("3. 试运行模式（查看会删除哪些文件但不实际删除）")
    print("4. 退出程序")
    
    while True:
        choice = input("\n请输入选项 (1-4): ").strip()
        
        if choice == '1':
            display_duplicates(duplicates)
        elif choice == '2':
            # 确认删除
            confirm = input("\n确认要删除重复文件吗？(y/n): ").strip().lower()
            if confirm in ['y', 'yes', '是']:
                deleted = delete_duplicates(duplicates, keep_first=True, dry_run=False)
                print(f"\n完成！已删除 {deleted} 个重复文件")
            else:
                print("操作已取消")
            break
        elif choice == '3':
            deleted = delete_duplicates(duplicates, keep_first=True, dry_run=True)
            print(f"\n试运行完成！将删除 {deleted} 个重复文件")
            print("如确认无误，请重新运行程序并选择选项2进行实际删除")
            break
        elif choice == '4':
            print("退出程序")
            break
        else:
            print("无效选项，请重新输入 (1-4)")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n用户中断程序")
        sys.exit(0)
    except Exception as e:
        print(f"\n程序执行出错: {e}")
        sys.exit(1)
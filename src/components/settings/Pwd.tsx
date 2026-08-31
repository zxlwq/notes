import React from 'react'
import { Shield, Eye, EyeOff } from 'lucide-react'

interface PwdProps {
  passwordSource: 'd1' | 'env' | 'postgresql' | 'unknown'
  newPassword: string
  showPassword: boolean
  changing: boolean
  recoveryConfigured: boolean
  settingUpRecovery: boolean
  onNewPasswordChange: (value: string) => void
  onToggleShowPassword: () => void
  onChangePassword: () => void
  onSetupRecovery: () => void
}

const Pwd: React.FC<PwdProps> = ({
  passwordSource,
  newPassword,
  showPassword,
  changing,
  recoveryConfigured,
  settingUpRecovery,
  onNewPasswordChange,
  onToggleShowPassword,
  onChangePassword,
  onSetupRecovery,
}) => (
  <div className="space-y-3 border-t border-white/50 pt-2">
    <div className="rounded-md border border-green-200 bg-green-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Shield className="size-4 text-green-600" />
        <span className="font-medium text-green-800">当前密码：</span>
      </div>
      <div className="ml-6 text-xs text-green-700">
        {passwordSource === 'env' && <span>环境变量</span>}
        {passwordSource === 'd1' && <span>D1数据库</span>}
        {passwordSource === 'postgresql' && <span>PostgreSQL数据库</span>}
        {passwordSource === 'unknown' && <span>环境变量</span>}
      </div>
    </div>

    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!changing && newPassword) onChangePassword()
      }}
    >
      <input
        type="text"
        name="username"
        autoComplete="username"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        defaultValue=""
        readOnly
      />
      <div className="flex items-center justify-between">
        <label htmlFor="new-password" className="font-medium text-gray-700">
          修改密码
        </label>
        <div className="relative">
          <input
            id="new-password"
            name="new-password"
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => onNewPasswordChange(e.target.value)}
            autoComplete="new-password"
            className="w-40 rounded-md border border-gray-300 px-3 py-1 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="输入新密码"
          />
          <button
            type="button"
            onClick={onToggleShowPassword}
            className="absolute right-2 top-1/2 -translate-y-1/2 transform text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={changing || !newPassword}
          className="rounded-md border border-transparent bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {changing ? '修改中...' : '确定'}
        </button>
      </div>
    </form>

    <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Shield className="size-4 text-amber-600" />
        <span className="font-medium text-amber-800">密码恢复码</span>
      </div>
      <p className="mb-2 text-xs text-amber-700">
        {recoveryConfigured
          ? '已配置恢复码。重新生成将使旧码失效。恢复码仅能重置登录密码，不能解密丢失加密密钥后的密文。'
          : '尚未配置。忘记密码时可用恢复码重置登录密码；若加密密钥已丢失，已加密笔记无法恢复。'}
      </p>
      <div className="flex justify-end">
        <button
          onClick={onSetupRecovery}
          disabled={settingUpRecovery}
          className="rounded-md border border-transparent bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {settingUpRecovery ? '生成中...' : recoveryConfigured ? '重新生成' : '生成恢复码'}
        </button>
      </div>
    </div>
  </div>
)

export default Pwd

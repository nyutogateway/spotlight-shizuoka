/**
 * spotlight/qa の編集画面。
 *
 * ビルド不要で読めるよう、JSX を使わず wp.element.createElement で書いている。
 * 表示側は render.php が受け持つので、ここは入力だけ。
 */
(function (blocks, blockEditor, element, components) {
  'use strict';

  var e = element.createElement;
  var RichText = blockEditor.RichText;

  blocks.registerBlockType('spotlight/qa', {
    edit: function (props) {
      var kind = props.attributes.kind === 'a' ? 'a' : 'q';

      return e(
        element.Fragment,
        null,
        // 質問か回答かを切り替える。段の中でまとめて置き換えられるよう
        // ツールバーではなくブロック上に出す
        e(
          blockEditor.BlockControls,
          null,
          e(
            components.ToolbarGroup,
            null,
            e(components.ToolbarButton, {
              text: 'Q',
              isPressed: kind === 'q',
              onClick: function () { props.setAttributes({ kind: 'q' }); }
            }),
            e(components.ToolbarButton, {
              text: 'A',
              isPressed: kind === 'a',
              onClick: function () { props.setAttributes({ kind: 'a' }); }
            })
          )
        ),
        e(
          'div',
          blockEditor.useBlockProps({ className: 'spot-qa spot-qa--' + kind }),
          e('span', { className: 'spot-qa__badge' }, kind.toUpperCase()),
          e(RichText, {
            tagName: 'p',
            value: props.attributes.text,
            allowedFormats: ['core/bold', 'core/italic', 'core/link'],
            placeholder: kind === 'q' ? '質問を入力' : '回答を入力',
            onChange: function (value) { props.setAttributes({ text: value }); }
          })
        )
      );
    },

    // 表示は render.php が組むので保存はしない
    save: function () { return null; }
  });
})(window.wp.blocks, window.wp.blockEditor, window.wp.element, window.wp.components);

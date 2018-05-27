import React from 'react';
import {
  EditorState,
  Modifier,
  CompositeDecorator,
  getDefaultKeyBinding
} from 'draft-js';
import DraftTypeahead, { normalizeSelectedIndex } from './DraftTypeahead';


const HASHTAG = '#';
const PERSON = '@';
const RELATION = '<>';
const HASHTAG_SELECT = ' ';

const HASHTAGS = [
  'Hash',
  'Tag'
];

const PEOPLE = [
  ['Someone Likeyou', 'https://randomuser.me/api/portraits/thumb/men/83.jpg'],
  ['Somebody Else', 'https://randomuser.me/api/portraits/thumb/men/84.jpg']
];

const RELATIONS = [
  'Related Relations',
  'Relationship'
];

function DB(token) {
  switch(token) {
    case HASHTAG:
      return HASHTAGS;
    case PERSON:
      return PEOPLE;
    case RELATION:
      return RELATIONS;
    default:
      console.error('Mention token is required!');
  }
}

function filterMention(token, query) {
  return DB(token).filter(mention => {
    mention = Array.isArray(mention) ? mention[0] : mention;
    return mention.toLowerCase().startsWith(query.toLowerCase());
  });
}

function MentionSpan(props) {
  return (
    <span style={styles.mentioned}>
      {props.children}
    </span>
  );
}

function getEntityStrategy(type) {
  return function (contentBlock, callback, contentState) {
    contentBlock.findEntityRanges(character => {
      const entityKey = character.getEntity();
      if (entityKey === null) {
        return false;
      }
      return contentState.getEntity(entityKey).getType() === type;
    }, callback);
  };
}

const decorator = new CompositeDecorator([
  {
    strategy: getEntityStrategy('MENTION'),
    component: MentionSpan
  }
]);

const Mentions = React.forwardRef(({ left, top, selectedIndex, text, token }, ref) => {
  const typeaheadStyle = Object.assign({}, styles.typeahead, {
    position: 'absolute',
    left,
    top
  });
  const filteredMentions = filterMention(token, text.replace(new RegExp('^' + token), ''));
  const normalizedIndex = normalizeSelectedIndex(
    selectedIndex,
    filteredMentions.length
  );

  return (
    <ul ref={ref} style={typeaheadStyle}>
      {filteredMentions.map((mention, index) => {
        let mentionImg;
        if (Array.isArray(mention)) {
          mentionImg = <img src={mention[1]} style={styles.mentionImg} />;
          mention = mention[0];
        }
        return (
          <li key={mention}
            style={
              index === normalizedIndex ? styles.selectedMention : styles.mention
            }
          >
            {mentionImg}
            <span style={styles.mentionText}>
              {token === HASHTAG && HASHTAG}
              {mention}
            </span>
          </li>
        );
      })}
    </ul>
  );
});

export default class DraftTypeaheadContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      editorState: EditorState.createEmpty(decorator),
      typeaheadState: null,
      currentToken: null
    };
    this.ulMentions = React.createRef();
  }

  componentDidUpdate() {
    this.ulMentions.current && this.ulMentions.current.scrollIntoView();
  }

  onChange = editorState => this.setState({ editorState });

  onTypeaheadChange = typeaheadState => this.setState({ typeaheadState });

  setToken = currentToken => this.setState({ currentToken });

  handleTypeaheadReturn = (text, selectedIndex, selectionState) => {
    const { editorState, currentToken } = this.state;

    if (currentToken === null) {
      return null;
    }

    const filteredMentions = filterMention(currentToken, text.replace(new RegExp('^' + currentToken), ''));
    const index = normalizeSelectedIndex(selectedIndex, filteredMentions.length);
    const filteredMention = Array.isArray(filteredMentions[index]) ? filteredMentions[index][0] : filteredMentions[index];
    const mentionText = filteredMention ? currentToken + filteredMention : text;

    const contentState = editorState.getCurrentContent();
    const contentStateWithEntity = contentState.createEntity('MENTION', 'IMMUTABLE');
    const mentionEntityKey = contentStateWithEntity.getLastCreatedEntityKey();
    const newContentStateWithEntity = Modifier.replaceText(
      contentStateWithEntity,
      selectionState,
      mentionText,
      null,
      mentionEntityKey
    );
    const nextEditorState = EditorState.push(
      editorState,
      newContentStateWithEntity,
      'apply-entity'
    );
    this.setState({ editorState: nextEditorState, currentToken: null });
  };

  handleKeyBindingFn(e) {
    switch (e.key) {
      case HASHTAG:
        this.setToken(HASHTAG);
        break;
      case PERSON:
        this.setToken(PERSON);
        break;
      case RELATION[1]:
        this.setToken(RELATION);
        break;
      case HASHTAG_SELECT:
        this.token === HASHTAG && this.handleReturn(e);
        break;
    }
    return getDefaultKeyBinding(e);
  }

  renderTypeahead() {
    if (this.state.typeaheadState === null || this.state.currentToken === null) {
      return null;
    }
    return <Mentions token={this.state.currentToken} ref={this.ulMentions} {...this.state.typeaheadState} />;
  }

  render() {
    return (
      <div>
        {this.renderTypeahead()}
        <div style={styles.editor}>
          <DraftTypeahead
            token={this.state.currentToken}
            editorState={this.state.editorState}
            onChange={this.onChange}
            onTypeaheadChange={this.onTypeaheadChange}
            setToken={this.setToken}
            handleTypeaheadReturn={this.handleTypeaheadReturn}
            keyBindingFn={this.handleKeyBindingFn}
          />
        </div>
      </div>
    );
  }
}

const styles = {
  editor: {
    minHeight: 80,
    padding: 10,
    border: '1px solid #999'
  },
  typeahead: {
    margin: 0,
    padding: 0,
    border: '1px solid #999',
    background: '#D7D7D7',
    listStyleType: 'none'
  },
  mention: {
    margin: 0,
    minWidth: '50px',
    color: '#5A88AB'
  },
  selectedMention: {
    margin: 0,
    background: '#6A89E0',
    color: '#5885AD'
  },
  mentionText: {
    padding: '4px',
  },
  mentionImg: {
    height: '52px',
    padding: '2px',
    verticalAlign: 'middle'
  },
  mentioned: {
    color: '#5A88AB'
  }
};

import React, { cloneElement } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { WizardHeader, WizardNav, WizardNavItem, Backdrop, Bullseye } from '@patternfly/react-core';
import WizardStep from './wizard-step';
import './wizard-styles.scss';
import get from 'lodash/get';
import set from 'lodash/set';

const Modal = ({ children, container, inModal }) => inModal ? createPortal(<Backdrop>
  <Bullseye>
    { children }
  </Bullseye>
</Backdrop>, container) : children;

class Wizard extends React.Component {
  constructor(props){
    super(props);

    // find if wizard contains any dynamic steps (nextStep is mapper object)
    const isDynamic = this.props.isDynamic ? true : this.props.fields.find(({ nextStep }) => typeof nextStep === 'object') ? true : false;

    // insert into navigation schema first step if dynamic, otherwise create the whole schema
    // if the wizard is dynamic, the navigation is build progressively
    const firstStep = this.props.fields.find(({ stepKey }) => stepKey === 1 || stepKey === '1');

    const navSchema = isDynamic ?
      [{ title: firstStep.title, index: 0, primary: true, substepOf: firstStep.substepOf }]
      : this.createSchema();

    this.state = {
      activeStep: this.props.fields[0].stepKey,
      prevSteps: [],
      activeStepIndex: 0,
      maxStepIndex: 0,
      isDynamic, // wizard contains nextStep mapper
      navSchema, // schema of navigation
      loading: true,
    };
  }

  componentDidMount() {
    if (this.props.inModal) {
      this.container = document.createElement('div');
      document.body.appendChild(this.container);
    }

    this.setState({ loading: false });
  }

  componentWillUnmount() {
    if (this.props.inModal && this.container) {
      document.body.removeChild(this.container);
    }
  }

  insertDynamicStep = (nextStep, navSchema) => {
    const { title, substepOf } = this.props.fields.find(({ stepKey }) => stepKey === nextStep);
    const lastStep = navSchema[navSchema.length - 1];

    return [
      ...navSchema,
      {
        title,
        substepOf,
        index: lastStep.index + 1,
        primary: (!substepOf) || (substepOf && substepOf !== lastStep.substepOf),
      },
    ];
  }

  handleNext = (nextStep, getRegisteredFields) =>
    this.setState(prevState =>
      ({
        registeredFieldsHistory: { ...prevState.registeredFieldsHistory, [prevState.activeStep]: getRegisteredFields() },
        activeStep: nextStep,
        prevSteps: prevState.prevSteps.includes(prevState.activeStep) ? prevState.prevSteps : [ ...prevState.prevSteps, prevState.activeStep ],
        activeStepIndex: prevState.activeStepIndex + 1,
        maxStepIndex: (prevState.activeStepIndex + 1) > prevState.maxStepIndex ? prevState.maxStepIndex + 1 : prevState.maxStepIndex,
        navSchema: this.state.isDynamic ? this.insertDynamicStep(nextStep, prevState.navSchema) : prevState.navSchema,
      }));

  handlePrev = () => this.jumpToStep(this.state.activeStepIndex - 1);

  findActiveFields = visitedSteps =>
    visitedSteps.map(key =>this.findCurrentStep(key).fields.map(({ name }) => name))
    .reduce((acc, curr) => curr.concat(acc.map(item => item)), []);

  handleSubmit = (values, visitedSteps, getRegisteredFields) => {
    // Add the final step fields to history
    const finalRegisteredFieldsHistory = {
      ...this.state.registeredFieldsHistory,
      [this.state.activeStep]: getRegisteredFields(),
    };

    const finalObject = {};

    // Find only visited fields
    Object.values([ ...visitedSteps, this.state.activeStep ]
    .reduce((obj, key) => ({ ...obj, [key]: finalRegisteredFieldsHistory[key] }), { }))
    .flat(Infinity).forEach((key) => set(finalObject, key, get(values, key)));

    return finalObject;
  }

  findCurrentStep = activeStep => this.props.fields.find(({ stepKey }) => stepKey === activeStep)

  // jumping in the wizzard by clicking on nav links
  jumpToStep = (index, valid) => {
    if (this.state.prevSteps[index]) {
      this.setState((prevState) =>
        ({
          activeStep: this.state.prevSteps[index],
          prevSteps: prevState.prevSteps.includes(prevState.activeStep) ? prevState.prevSteps : [ ...prevState.prevSteps, prevState.activeStep ],
          activeStepIndex: index,
        }));

      // jumping in dynamic form disables returning to back (!)
      if (this.state.isDynamic) {
        this.setState((prevState) => ({
          navSchema: prevState.navSchema.slice(0, index + 1),
          prevSteps: prevState.prevSteps.slice(0, index + 1),
        }));
      }

      // invalid state disables jumping forward until it fixed (!)
      if (valid === false) {
        this.setState((prevState) => ({
          prevSteps: prevState.prevSteps.slice(0, index + 2),
          maxStepIndex: prevState.prevSteps.slice(0, index + 1).length,
        }));
      }
    }
  };

  // builds schema used for generating of the navigation links
  createSchema = () => {
    let schema = [];
    let field = this.props.fields.find(({ stepKey }) => stepKey === 1 || stepKey === '1'); // find first wizard step
    let index = 0;

    while (field){
      schema = [
        ...schema,
        { title: field.title,
          substepOf: field.substepOf,
          index: index++,
          primary: (!schema[schema.length - 1] || !field.substepOf || field.substepOf !== schema[schema.length - 1].substepOf) },
      ];

      field = this.props.fields.find(({ stepKey }) => stepKey === field.nextStep);
    }

    return schema;
  };

  render() {
    if (this.state.loading) {
      return null;
    }

    const {
      title, description, FieldProvider, formOptions, buttonLabels, buttonsClassName, inModal, setFullWidth, setFullHeight, isCompactNav,
    } = this.props;
    const { activeStepIndex, navSchema, maxStepIndex } = this.state;

    const handleSubmit = () =>
      formOptions.onSubmit(
        this.handleSubmit(
          formOptions.getState().values,
          [ ...this.state.prevSteps, this.state.activeStep ],
          formOptions.getRegisteredFields,
        )
      );

    const currentStep = (
      <WizardStep
        { ...this.findCurrentStep(this.state.activeStep) }
        formOptions={{
          ...formOptions,
          handleSubmit,
        }}
        buttonLabels={ buttonLabels }
        FieldProvider={ FieldProvider }
        buttonsClassName={ buttonsClassName }
      />);

    const createStepsMap = () => navSchema
    .filter(field => field.primary)
    .map(step => {
      const substeps = step.substepOf && navSchema.filter(field => field.substepOf === step.substepOf);

      return <WizardNavItem
        key={ step.substepOf || step.title }
        text={ step.substepOf || step.title }
        isCurrent={ substeps ? activeStepIndex >= step.index && activeStepIndex < step.index + substeps.length : activeStepIndex === step.index }
        isDisabled={ formOptions.valid ? maxStepIndex < step.index : step.index > activeStepIndex }
        onNavItemClick={ (ind) => this.jumpToStep(ind, formOptions.valid) }
        step={ step.index }
      >
        { substeps && <WizardNav returnList>
          { substeps.map(substep => <WizardNavItem
            key={ substep.title }
            text={ substep.title }
            isCurrent={ activeStepIndex === substep.index }
            isDisabled={ formOptions.valid ?
              maxStepIndex < substep.index
              : substep.index > activeStepIndex }
            onNavItemClick={ (ind) => this.jumpToStep(ind, formOptions.valid) }
            step={ substep.index }
          />) }
        </WizardNav> }
      </WizardNavItem>;
    });

    return (
      <Modal inModal={ inModal } container={ this.container }>
        <div className={ `pf-c-wizard ${inModal ? '' : 'no-shadow'} ${isCompactNav ? 'pf-m-compact-nav' : ''} ${setFullWidth ? 'pf-m-full-width' : ''} ${setFullHeight ? 'pf-m-full-height' : ''}` }
          role="dialog"
          aria-modal={ inModal ? 'true' : undefined }
        >
          { title && <WizardHeader
            title={ title }
            description={ description }
            onClose={ formOptions.onCancel }
          /> }
          <div className="pf-c-wizard__outer-wrap">
            <WizardNav>
              { createStepsMap() }
            </WizardNav>
            { cloneElement(currentStep, {
              handleNext: (nextStep) => this.handleNext(nextStep, formOptions.getRegisteredFields),
              handlePrev: this.handlePrev,
              disableBack: this.state.activeStepIndex === 0,
            }) }
          </div>
        </div>
      </Modal>
    );
  }
}

Wizard.propTypes = {
  buttonLabels: PropTypes.shape({
    submit: PropTypes.string.isRequired,
    cancel: PropTypes.string.isRequired,
    back: PropTypes.string.isRequired,
    next: PropTypes.string.isRequired,
  }).isRequired,
  buttonsClassName: PropTypes.string,
  title: PropTypes.any,
  description: PropTypes.any,
  FieldProvider: PropTypes.PropTypes.oneOfType([ PropTypes.object, PropTypes.func ]).isRequired,
  formOptions: PropTypes.shape({
    getState: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    onCancel: PropTypes.func,
    getRegisteredFields: PropTypes.func.isRequired,
  }),
  fields: PropTypes.arrayOf(PropTypes.shape({
    stepKey: PropTypes.oneOfType([ PropTypes.string, PropTypes.number ]).isRequired,
  })).isRequired,
  isCompactNav: PropTypes.bool,
  inModal: PropTypes.bool,
  setFullWidth: PropTypes.bool,
  setFullHeight: PropTypes.bool,
  isDynamic: PropTypes.bool,
};

const defaultLabels = {
  submit: 'Submit',
  cancel: 'Cancel',
  back: 'Back',
  next: 'Next',
};

const WizardFunction = ({ buttonLabels, ...props }) => <Wizard { ...props } buttonLabels={{ ...defaultLabels, ...buttonLabels }}/>;

WizardFunction.propTypes = {
  buttonLabels: PropTypes.shape({
    submit: PropTypes.string,
    cancel: PropTypes.string,
    back: PropTypes.string,
  }),
};

WizardFunction.defaultProps = {
  buttonLabels: {},
};

export default WizardFunction;
